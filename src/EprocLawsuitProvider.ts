import IEprocLawsuit from "./entities/IEprocLawsuit";
import axios from "axios";
import { JSDOM } from "jsdom";
import EprocAuthProvider from "./EprocAuthProvider";
import EprocLawsuitParser from "./EprocLawsuitParser";
import iconv from 'iconv';
import sleep from "./helpers/sleep";
import Defaults from "./defaults";

export default class EprocLawsuitProvider {

    constructor(
        private readonly authProvider: EprocAuthProvider,
        private readonly crawlingUA: string = Defaults.crawlingUA,
        private readonly skipOnError: boolean = Defaults.skipOnError,
        private readonly sleepTime: number = Defaults.sleepTime
    ) {
        
    }

    private async getHomeURL(): Promise<string> {
        if (!this.authProvider.hashedHomeURL) {
            await this.authProvider.authenticate();
        }
        return this.authProvider.hashedHomeURL;
    }

    private async fetchSessionCookies(): Promise<string> {
        if (!this.authProvider.sessionCookies) {
            await this.authProvider.authenticate();
        }
        return this.authProvider.getCookieHeader();
    }

    private async get(url: string, cookies: string): Promise<any> {
        const response = await axios.get(url, {
            headers: {
                'Cookie': cookies,
                'User-Agent': this.crawlingUA
            },
            responseType: 'arraybuffer'
        });

        const { data } = response;

        const ic = iconv.Iconv('ISO-8859-1', 'UTF-8');
        return ic.convert(data).toString('utf-8');
    }

    private async post(url: string, cookies: string, data: any, contentType: string = 'text/plain', extra = {}, raw = false): Promise<any> {
        const response = await axios.post(url, data, {
            headers: {
                'Cookie': cookies,
                'User-Agent': this.crawlingUA,
                'Content-Type': contentType
            },
            ...extra
        });

        return raw ? response : response.data;
    }

    private async fetchOtherPartiesHTML(html: string): Promise<string> {

        if (!html.includes(`javascript:carregarPartes`)) {
            return null;
        }

        const apiURLPattern = /controlador_ajax.php\?acao_ajax=carregar_partes_ocultas_processo&hash=(([a-z]|[0-9]){32})/;
        const matches = apiURLPattern.exec(html);

        const hash = matches[1];

        const [_, idProcesso, idPessoa, tipoParte] = /javascript:carregarPartes\('([0-9]+)','([0-9]+)','([A-Z])'\)/.exec(html);

        const fd = new URLSearchParams();
        fd.append('idProcesso', idProcesso);
        fd.append('idPessoaCarregada', idPessoa);
        fd.append('tipoParte', tipoParte);
        fd.append('sinPermiteConsultaReuSobMonitoramento', 'N');
        fd.append('sinPermiteCadastroReuSobMonitoramento', 'N');

        const postResponse = await this.post(
            `https://eproc1g.tjrs.jus.br/eproc/controlador_ajax.php?acao_ajax=carregar_partes_ocultas_processo&hash=${hash}`,
            await this.fetchSessionCookies(),
            fd.toString(),
            'application/x-www-form-urlencoded'
        );

        return postResponse;

    }

    private parseLawsuitFromHTML(html: string, otherPartiesAjax: string): IEprocLawsuit {
        const dom = new JSDOM(html).window.document;
        const parser = new EprocLawsuitParser(dom, otherPartiesAjax);
        return parser.parseLawsuit();
    }

    public async fetchDirectLawsuit(url: string): Promise<IEprocLawsuit> {
        const pageHtml = await this.get(url, await this.fetchSessionCookies());
        const otherPartiesAjax = await this.fetchOtherPartiesHTML(pageHtml);
        return this.parseLawsuitFromHTML(pageHtml, otherPartiesAjax);
    }

    private async fetchLawsuitSearchPage(): Promise<string> {

        const searchUrlPattern = /(controlador\.php\?acao=processo_pesquisa_rapida&hash=([a-z]|[0-9]){32})/;
        const homePage = await this.get(await this.getHomeURL(), await this.fetchSessionCookies());
        const [searchPageUrl] = [...(searchUrlPattern.exec(homePage)||[])];

        if (!searchPageUrl) {
            throw new Error('No search page URL!');
        }

        return await this.get(`https://eproc1g.tjrs.jus.br/eproc/${searchPageUrl}`, await this.fetchSessionCookies());
    }

    private async getLawsuitURL(number: string): Promise<string> {

        const searchUrlPattern = /(controlador\.php\?acao=processo_pesquisa_rapida&hash=([a-z]|[0-9]){32})/;

        const searchPage = await this.fetchLawsuitSearchPage();

        const [postUrl] = [...searchUrlPattern.exec(searchPage)];

        const postData = {
            txtNumProcessoPesquisaRapida: number,
            acao_retorno_pesquisa_rapida: 'processo_consultar',
            btnPesquisaRapidaSubmit: ''
        }

        const urlFormData = new URLSearchParams(postData);

        const postResponse = await this.post(
            `https://eproc1g.tjrs.jus.br/eproc/${postUrl}`,
            await this.fetchSessionCookies(),
            urlFormData.toString(),
            'application/x-www-form-urlencoded', {
                maxRedirects: 0,
                validateStatus: status => status === 302,
            }, true
        );

        return `https://eproc1g.tjrs.jus.br/eproc/${postResponse.headers.location}`;
    }

    public async fetchLawsuit(number: string): Promise<IEprocLawsuit> {
        const url = await this.getLawsuitURL(number);
        return await this.fetchDirectLawsuit(url);
    }

    public async fetchEntityLawsuitURLs(taxID: string): Promise<string[]> {

        const searchPage = await this.fetchLawsuitSearchPage();
        const urlPattern = /(controlador_ajax\.php\?acao_ajax=processos_consulta_por_documento_identificacao&hash=([a-z]|[0-9]){32})/;

        const [ajaxUrl] = [...(urlPattern.exec(searchPage)||[])];

        if (!ajaxUrl) {
            throw new Error(`No AJAX URL! (${urlPattern}) ${searchPage}`);
        }

        const response = await this.post(
            `https://eproc1g.tjrs.jus.br/eproc/${ajaxUrl}`,
            await this.fetchSessionCookies(),
            `hdnInfraTipoPagina=1&acao_origem=&acao_retorno=&acao=pesquisa_processo_doc_parte&tipoPesquisa=CP&strDocParte=${taxID}&selIdClasse=0000100000&selectAllselIdClasse=on&selectItemselIdClasse=0000100000&selectItemselIdClasse=0000000452&selectItemselIdClasse=0000000456&selectItemselIdClasse=0000000459&selectItemselIdClasse=0000000003&selectItemselIdClasse=0000000002&selectItemselIdClasse=0000000413&selectItemselIdClasse=0000000001&selectItemselIdClasse=0000100072&selectItemselIdClasse=0000100095&selectItemselIdClasse=0000000006&selectItemselIdClasse=0000000300&selectItemselIdClasse=0000000013&selectItemselIdClasse=0000000388&selectItemselIdClasse=0000000387&selectItemselIdClasse=0000000018&selectItemselIdClasse=0000000301&selectItemselIdClasse=0000000218&selectItemselIdClasse=0000000196&selectItemselIdClasse=0000000416&selectItemselIdClasse=0000000302&selectItemselIdClasse=0000000022&selectItemselIdClasse=0000100037&selectItemselIdClasse=0000000303&selectItemselIdClasse=0000000304&selectItemselIdClasse=0000000305&selectItemselIdClasse=0000000273&selectItemselIdClasse=0000000389&selectItemselIdClasse=0000000411&selectItemselIdClasse=0000000414&selectItemselIdClasse=0000000373&selectItemselIdClasse=0000000374&selectItemselIdClasse=0000000426&selectItemselIdClasse=0000000230&selectItemselIdClasse=0000000171&selectItemselIdClasse=0000000165&selectItemselIdClasse=0000000169&selectItemselIdClasse=0000000306&selectItemselIdClasse=0000000307&selectItemselIdClasse=0000000427&selectItemselIdClasse=0000000428&selectItemselIdClasse=0000000032&selectItemselIdClasse=0000000412&selectItemselIdClasse=0000000308&selectItemselIdClasse=0000000779&selectItemselIdClasse=0000008750&selectItemselIdClasse=0000100057&selectItemselIdClasse=0000000449&selectItemselIdClasse=0000000036&selectItemselIdClasse=0000000450&selectItemselIdClasse=0000100098&selectItemselIdClasse=0000100099&selectItemselIdClasse=0000004350&selectItemselIdClasse=0000000037&selectItemselIdClasse=0000000038&selectItemselIdClasse=0000000390&selectItemselIdClasse=0000000309&selectItemselIdClasse=0000000040&selectItemselIdClasse=0000000310&selectItemselIdClasse=0000000311&selectItemselIdClasse=0000000312&selectItemselIdClasse=0000000313&selectItemselIdClasse=0000100109&selectItemselIdClasse=0000000468&selectItemselIdClasse=0000000203&selectItemselIdClasse=0000000045&selectItemselIdClasse=0000000004&selectItemselIdClasse=0000100001&selectItemselIdClasse=0000000314&selectItemselIdClasse=0000000231&selectItemselIdClasse=0000100002&selectItemselIdClasse=0000000005&selectItemselIdClasse=0000000315&selectItemselIdClasse=0000000048&selectItemselIdClasse=0000000316&selectItemselIdClasse=0000000362&selectItemselIdClasse=0000000050&selectItemselIdClasse=0000100086&selectItemselIdClasse=0000100085&selectItemselIdClasse=0000000317&selectItemselIdClasse=0000100003&selectItemselIdClasse=0000000214&selectItemselIdClasse=0000000052&selectItemselIdClasse=0000100004&selectItemselIdClasse=0000100005&selectItemselIdClasse=0000100118&selectItemselIdClasse=0000000064&selectItemselIdClasse=0000100092&selectItemselIdClasse=0000000318&selectItemselIdClasse=0000000204&selectItemselIdClasse=0000000054&selectItemselIdClasse=0000000055&selectItemselIdClasse=0000100042&selectItemselIdClasse=0000000319&selectItemselIdClasse=0000100119&selectItemselIdClasse=0000000007&selectItemselIdClasse=0000100076&selectItemselIdClasse=0000100112&selectItemselIdClasse=0000000057&selectItemselIdClasse=0000014550&selectItemselIdClasse=0000100158&selectItemselIdClasse=0000000058&selectItemselIdClasse=0000000420&selectItemselIdClasse=0000100055&selectItemselIdClasse=0000005220&selectItemselIdClasse=0000014603&selectItemselIdClasse=0000000445&selectItemselIdClasse=0000000435&selectItemselIdClasse=0000000422&selectItemselIdClasse=0000100063&selectItemselIdClasse=0000100115&selectItemselIdClasse=0000000320&selectItemselIdClasse=0000000407&selectItemselIdClasse=0000000060&selectItemselIdClasse=0000000418&selectItemselIdClasse=0000006020&selectItemselIdClasse=0000014544&selectItemselIdClasse=0000014607&selectItemselIdClasse=0000100054&selectItemselIdClasse=0000000444&selectItemselIdClasse=0000000433&selectItemselIdClasse=0000000424&selectItemselIdClasse=0000000421&selectItemselIdClasse=0000100064&selectItemselIdClasse=0000100133&selectItemselIdClasse=0000000235&selectItemselIdClasse=0000000463&selectItemselIdClasse=0000100132&selectItemselIdClasse=0000000423&selectItemselIdClasse=0000014604&selectItemselIdClasse=0000000061&selectItemselIdClasse=0000000425&selectItemselIdClasse=0000014545&selectItemselIdClasse=0000000419&selectItemselIdClasse=0000000062&selectItemselIdClasse=0000100134&selectItemselIdClasse=0000012820&selectItemselIdClasse=0000008530&selectItemselIdClasse=0000008460&selectItemselIdClasse=0000008470&selectItemselIdClasse=0000008540&selectItemselIdClasse=0000008480&selectItemselIdClasse=0000008490&selectItemselIdClasse=0000008550&selectItemselIdClasse=0000008620&selectItemselIdClasse=0000008570&selectItemselIdClasse=0000008660&selectItemselIdClasse=0000006740&selectItemselIdClasse=0000008590&selectItemselIdClasse=0000006710&selectItemselIdClasse=0000006760&selectItemselIdClasse=0000008600&selectItemselIdClasse=0000006720&selectItemselIdClasse=0000006770&selectItemselIdClasse=0000008610&selectItemselIdClasse=0000006730&selectItemselIdClasse=0000006780&selectItemselIdClasse=0000014520&selectItemselIdClasse=0000000139&selectItemselIdClasse=0000008500&selectItemselIdClasse=0000002480&selectItemselIdClasse=0000014546&selectItemselIdClasse=0000014586&selectItemselIdClasse=0000014587&selectItemselIdClasse=0000014589&selectItemselIdClasse=0000014588&selectItemselIdClasse=0000014590&selectItemselIdClasse=0000014529&selectItemselIdClasse=0000100077&selectItemselIdClasse=0000100155&selectItemselIdClasse=0000000008&selectItemselIdClasse=0000000009&selectItemselIdClasse=0000000321&selectItemselIdClasse=0000000438&selectItemselIdClasse=0000100006&selectItemselIdClasse=0000000322&selectItemselIdClasse=0000000066&selectItemselIdClasse=0000000744&selectItemselIdClasse=0000000746&selectItemselIdClasse=0000014532&selectItemselIdClasse=0000100065&selectItemselIdClasse=0000000216&selectItemselIdClasse=0000100128&selectItemselIdClasse=0000002160&selectItemselIdClasse=0000000358&selectItemselIdClasse=0000000011&selectItemselIdClasse=0000000404&selectItemselIdClasse=0000000010&selectItemselIdClasse=0000100124&selectItemselIdClasse=0000100007&selectItemselIdClasse=0000000232&selectItemselIdClasse=0000000323&selectItemselIdClasse=0000000467&selectItemselIdClasse=0000100149&selectItemselIdClasse=0000000370&selectItemselIdClasse=0000000221&selectItemselIdClasse=0000000250&selectItemselIdClasse=0000000166&selectItemselIdClasse=0000100079&selectItemselIdClasse=0000100080&selectItemselIdClasse=0000000168&selectItemselIdClasse=0000000164&selectItemselIdClasse=0000000170&selectItemselIdClasse=0000000220&selectItemselIdClasse=0000014613&selectItemselIdClasse=0000100083&selectItemselIdClasse=0000100136&selectItemselIdClasse=0000000471&selectItemselIdClasse=0000014559&selectItemselIdClasse=0000014619&selectItemselIdClasse=0000100040&selectItemselIdClasse=0000100008&selectItemselIdClasse=0000000199&selectItemselIdClasse=0000100039&selectItemselIdClasse=0000000068&selectItemselIdClasse=0000000406&selectItemselIdClasse=0000000460&selectItemselIdClasse=0000000219&selectItemselIdClasse=0000000014&selectItemselIdClasse=0000000454&selectItemselIdClasse=0000000070&selectItemselIdClasse=0000000015&selectItemselIdClasse=0000000398&selectItemselIdClasse=0000000016&selectItemselIdClasse=0000000017&selectItemselIdClasse=0000000209&selectItemselIdClasse=0000000208&selectItemselIdClasse=0000000027&selectItemselIdClasse=0000014558&selectItemselIdClasse=0000100009&selectItemselIdClasse=0000100010&selectItemselIdClasse=0000000069&selectItemselIdClasse=0000000399&selectItemselIdClasse=0000100088&selectItemselIdClasse=0000100034&selectItemselIdClasse=0000000071&selectItemselIdClasse=0000000410&selectItemselIdClasse=0000000072&selectItemselIdClasse=0000000408&selectItemselIdClasse=0000000073&selectItemselIdClasse=0000000391&selectItemselIdClasse=0000000357&selectItemselIdClasse=0000000074&selectItemselIdClasse=0000000324&selectItemselIdClasse=0000000325&selectItemselIdClasse=0000100011&selectItemselIdClasse=0000000326&selectItemselIdClasse=0000000078&selectItemselIdClasse=0000000392&selectItemselIdClasse=0000000079&selectItemselIdClasse=0000100157&selectItemselIdClasse=0000014596&selectItemselIdClasse=0000100073&selectItemselIdClasse=0000000364&selectItemselIdClasse=0000000202&selectItemselIdClasse=0000000327&selectItemselIdClasse=0000008850&selectItemselIdClasse=0000000772&selectItemselIdClasse=0000000328&selectItemselIdClasse=0000100137&selectItemselIdClasse=0000000082&selectItemselIdClasse=0000000083&selectItemselIdClasse=0000000084&selectItemselIdClasse=0000000085&selectItemselIdClasse=0000000086&selectItemselIdClasse=0000000087&selectItemselIdClasse=0000000394&selectItemselIdClasse=0000100131&selectItemselIdClasse=0000004690&selectItemselIdClasse=0000004640&selectItemselIdClasse=0000000237&selectItemselIdClasse=0000000252&selectItemselIdClasse=0000000365&selectItemselIdClasse=0000000371&selectItemselIdClasse=0000000088&selectItemselIdClasse=0000000393&selectItemselIdClasse=0000000437&selectItemselIdClasse=0000000089&selectItemselIdClasse=0000003901&selectItemselIdClasse=0000000090&selectItemselIdClasse=0000000091&selectItemselIdClasse=0000000092&selectItemselIdClasse=0000000395&selectItemselIdClasse=0000004630&selectItemselIdClasse=0000000439&selectItemselIdClasse=0000100130&selectItemselIdClasse=0000014531&selectItemselIdClasse=0000002050&selectItemselIdClasse=0000014527&selectItemselIdClasse=0000000239&selectItemselIdClasse=0000000254&selectItemselIdClasse=0000100031&selectItemselIdClasse=0000000211&selectItemselIdClasse=0000000363&selectItemselIdClasse=0000100012&selectItemselIdClasse=0000100102&selectItemselIdClasse=0000100103&selectItemselIdClasse=0000100123&selectItemselIdClasse=0000100093&selectItemselIdClasse=0000000386&selectItemselIdClasse=0000000366&selectItemselIdClasse=0000000198&selectItemselIdClasse=0000000384&selectItemselIdClasse=0000014557&selectItemselIdClasse=0000000094&selectItemselIdClasse=0000000241&selectItemselIdClasse=0000100013&selectItemselIdClasse=0000100138&selectItemselIdClasse=0000000382&selectItemselIdClasse=0000100041&selectItemselIdClasse=0000000095&selectItemselIdClasse=0000000381&selectItemselIdClasse=0000100062&selectItemselIdClasse=0000000096&selectItemselIdClasse=0000000097&selectItemselIdClasse=0000000429&selectItemselIdClasse=0000000098&selectItemselIdClasse=0000000430&selectItemselIdClasse=0000000383&selectItemselIdClasse=0000000385&selectItemselIdClasse=0000000329&selectItemselIdClasse=0000000099&selectItemselIdClasse=0000100139&selectItemselIdClasse=0000100066&selectItemselIdClasse=0000100140&selectItemselIdClasse=0000100141&selectItemselIdClasse=0000100043&selectItemselIdClasse=0000000417&selectItemselIdClasse=0000100100&selectItemselIdClasse=0000100108&selectItemselIdClasse=0000100156&selectItemselIdClasse=0000000100&selectItemselIdClasse=0000000431&selectItemselIdClasse=0000000205&selectItemselIdClasse=0000000477&selectItemselIdClasse=0000000470&selectItemselIdClasse=0000000249&selectItemselIdClasse=0000000101&selectItemselIdClasse=0000000377&selectItemselIdClasse=0000009800&selectItemselIdClasse=0000000102&selectItemselIdClasse=0000100035&selectItemselIdClasse=0000100105&selectItemselIdClasse=0000100053&selectItemselIdClasse=0000100014&selectItemselIdClasse=0000000210&selectItemselIdClasse=0000014601&selectItemselIdClasse=0000000130&selectItemselIdClasse=0000012077&selectItemselIdClasse=0000100081&selectItemselIdClasse=0000003900&selectItemselIdClasse=0000002900&selectItemselIdClasse=0000000020&selectItemselIdClasse=0000001050&selectItemselIdClasse=0000001040&selectItemselIdClasse=0000001030&selectItemselIdClasse=0000000409&selectItemselIdClasse=0000000200&selectItemselIdClasse=0000000103&selectItemselIdClasse=0000000104&selectItemselIdClasse=0000000397&selectItemselIdClasse=0000008790&selectItemselIdClasse=0000007800&selectItemselIdClasse=0000100067&selectItemselIdClasse=0000100044&selectItemselIdClasse=0000000105&selectItemselIdClasse=0000000436&selectItemselIdClasse=0000000513&selectItemselIdClasse=0000014548&selectItemselIdClasse=0000014549&selectItemselIdClasse=0000014595&selectItemselIdClasse=0000014597&selectItemselIdClasse=0000000106&selectItemselIdClasse=0000000107&selectItemselIdClasse=0000000396&selectItemselIdClasse=0000008780&selectItemselIdClasse=0000008820&selectItemselIdClasse=0000008950&selectItemselIdClasse=0000008810&selectItemselIdClasse=0000008890&selectItemselIdClasse=0000008740&selectItemselIdClasse=0000100068&selectItemselIdClasse=0000014621&selectItemselIdClasse=0000014547&selectItemselIdClasse=0000100127&selectItemselIdClasse=0000100147&selectItemselIdClasse=0000100069&selectItemselIdClasse=0000014574&selectItemselIdClasse=0000014570&selectItemselIdClasse=0000014575&selectItemselIdClasse=0000000441&selectItemselIdClasse=0000100110&selectItemselIdClasse=0000014584&selectItemselIdClasse=0000014556&selectItemselIdClasse=0000100126&selectItemselIdClasse=0000100148&selectItemselIdClasse=0000100070&selectItemselIdClasse=0000000110&selectItemselIdClasse=0000000604&selectItemselIdClasse=0000000330&selectItemselIdClasse=0000000415&selectItemselIdClasse=0000100015&selectItemselIdClasse=0000100059&selectItemselIdClasse=0000000440&selectItemselIdClasse=0000100045&selectItemselIdClasse=0000000112&selectItemselIdClasse=0000000824&selectItemselIdClasse=0000000108&selectItemselIdClasse=0000100016&selectItemselIdClasse=0000100017&selectItemselIdClasse=0000100018&selectItemselIdClasse=0000100019&selectItemselIdClasse=0000000113&selectItemselIdClasse=0000100113&selectItemselIdClasse=0000000132&selectItemselIdClasse=0000000458&selectItemselIdClasse=0000100020&selectItemselIdClasse=0000000360&selectItemselIdClasse=0000000461&selectItemselIdClasse=0000000462&selectItemselIdClasse=0000000455&selectItemselIdClasse=0000000114&selectItemselIdClasse=0000000401&selectItemselIdClasse=0000014554&selectItemselIdClasse=0000000115&selectItemselIdClasse=0000000116&selectItemselIdClasse=0000000356&selectItemselIdClasse=0000014555&selectItemselIdClasse=0000000212&selectItemselIdClasse=0000000213&selectItemselIdClasse=0000000331&selectItemselIdClasse=0000000378&selectItemselIdClasse=0000000118&selectItemselIdClasse=0000000375&selectItemselIdClasse=0000000750&selectItemselIdClasse=0000000376&selectItemselIdClasse=0000000832&selectItemselIdClasse=0000008340&selectItemselIdClasse=0000000119&selectItemselIdClasse=0000000379&selectItemselIdClasse=0000100091&selectItemselIdClasse=0000000469&selectItemselIdClasse=0000000380&selectItemselIdClasse=0000000255&selectItemselIdClasse=0000000120&selectItemselIdClasse=0000000121&selectItemselIdClasse=0000000122&selectItemselIdClasse=0000000123&selectItemselIdClasse=0000000124&selectItemselIdClasse=0000000125&selectItemselIdClasse=0000000126&selectItemselIdClasse=0000000332&selectItemselIdClasse=0000000333&selectItemselIdClasse=0000000129&selectItemselIdClasse=0000000334&selectItemselIdClasse=0000000367&selectItemselIdClasse=0000000133&selectItemselIdClasse=0000000243&selectItemselIdClasse=0000000368&selectItemselIdClasse=0000000135&selectItemselIdClasse=0000000138&selectItemselIdClasse=0000000140&selectItemselIdClasse=0000000163&selectItemselIdClasse=0000100078&selectItemselIdClasse=0000100116&selectItemselIdClasse=0000100056&selectItemselIdClasse=0000100117&selectItemselIdClasse=0000000028&selectItemselIdClasse=0000000141&selectItemselIdClasse=0000000335&selectItemselIdClasse=0000000134&selectItemselIdClasse=0000000453&selectItemselIdClasse=0000000143&selectItemselIdClasse=0000000206&selectItemselIdClasse=0000000144&selectItemselIdClasse=0000000400&selectItemselIdClasse=0000000145&selectItemselIdClasse=0000000369&selectItemselIdClasse=0000000372&selectItemselIdClasse=0000000146&selectItemselIdClasse=0000000226&selectItemselIdClasse=0000000227&selectItemselIdClasse=0000000336&selectItemselIdClasse=0000000148&selectItemselIdClasse=0000000149&selectItemselIdClasse=0000001010&selectItemselIdClasse=0000100114&selectItemselIdClasse=0000014582&selectItemselIdClasse=0000000443&selectItemselIdClasse=0000001011&selectItemselIdClasse=0000000150&selectItemselIdClasse=0000100106&selectItemselIdClasse=0000000337&selectItemselIdClasse=0000000153&selectItemselIdClasse=0000000154&selectItemselIdClasse=0000000155&selectItemselIdClasse=0000000156&selectItemselIdClasse=0000100154&selectItemselIdClasse=0000000338&selectItemselIdClasse=0000000152&selectItemselIdClasse=0000100101&selectItemselIdClasse=0000000158&selectItemselIdClasse=0000009310&selectItemselIdClasse=0000014581&selectItemselIdClasse=0000000663&selectItemselIdClasse=0000014598&selectItemselIdClasse=0000000434&selectItemselIdClasse=0000014528&selectItemselIdClasse=0000014521&selectItemselIdClasse=0000014599&selectItemselIdClasse=0000000257&selectItemselIdClasse=0000100153&selectItemselIdClasse=0000100071&selectItemselIdClasse=0000100111&selectItemselIdClasse=0000000246&selectItemselIdClasse=0000014602&selectItemselIdClasse=0000000339&selectItemselIdClasse=0000009388&selectItemselIdClasse=0000000340&selectItemselIdClasse=0000009333&selectItemselIdClasse=0000000217&selectItemselIdClasse=0000100074&selectItemselIdClasse=0000000029&selectItemselIdClasse=0000100082&selectItemselIdClasse=0000100075&selectItemselIdClasse=0000100032&selectItemselIdClasse=0000000432&selectItemselIdClasse=0000000161&selectItemselIdClasse=0000100146&selectItemselIdClasse=0000000247&selectItemselIdClasse=0000000162&selectItemselIdClasse=0000000167&selectItemselIdClasse=0000000228&selectItemselIdClasse=0000100036&selectItemselIdClasse=0000010441&selectItemselIdClasse=0000100061&selectItemselIdClasse=0000100121&selectItemselIdClasse=0000000136&selectItemselIdClasse=0000001012&selectItemselIdClasse=0000100058&selectItemselIdClasse=0000000137&selectItemselIdClasse=0000000457&selectItemselIdClasse=0000000172&selectItemselIdClasse=0000100090&selectItemselIdClasse=0000000341&selectItemselIdClasse=0000100060&selectItemselIdClasse=0000000187&selectItemselIdClasse=0000000342&selectItemselIdClasse=0000014573&selectItemselIdClasse=0000014571&selectItemselIdClasse=0000014572&selectItemselIdClasse=0000100125&selectItemselIdClasse=0000100129&selectItemselIdClasse=0000014583&selectItemselIdClasse=0000014600&selectItemselIdClasse=0000000343&selectItemselIdClasse=0000000451&selectItemselIdClasse=0000100142&selectItemselIdClasse=0000000403&selectItemselIdClasse=0000100046&selectItemselIdClasse=0000100047&selectItemselIdClasse=0000000344&selectItemselIdClasse=0000000474&selectItemselIdClasse=0000000465&selectItemselIdClasse=0000000345&selectItemselIdClasse=0000000346&selectItemselIdClasse=0000000180&selectItemselIdClasse=0000000181&selectItemselIdClasse=0000000448&selectItemselIdClasse=0000100143&selectItemselIdClasse=0000000176&selectItemselIdClasse=0000000466&selectItemselIdClasse=0000000464&selectItemselIdClasse=0000000361&selectItemselIdClasse=0000100048&selectItemselIdClasse=0000100049&selectItemselIdClasse=0000014553&selectItemselIdClasse=0000100021&selectItemselIdClasse=0000100089&selectItemselIdClasse=0000000224&selectItemselIdClasse=0000100120&selectItemselIdClasse=0000100052&selectItemselIdClasse=0000000347&selectItemselIdClasse=0000000348&selectItemselIdClasse=0000000349&selectItemselIdClasse=0000000472&selectItemselIdClasse=0000000473&selectItemselIdClasse=0000000222&selectItemselIdClasse=0000100033&selectItemselIdClasse=0000100104&selectItemselIdClasse=0000000033&selectItemselIdClasse=0000000350&selectItemselIdClasse=0000000186&selectItemselIdClasse=0000000351&selectItemselIdClasse=0000000352&selectItemselIdClasse=0000009445&selectItemselIdClasse=0000009666&selectItemselIdClasse=0000100107&selectItemselIdClasse=0000000190&selectItemselIdClasse=0000000402&selectItemselIdClasse=0000100150&selectItemselIdClasse=0000000442&selectItemselIdClasse=0000000258&selectItemselIdClasse=0000000248&selectItemselIdClasse=0000100050&selectItemselIdClasse=0000000109&selectItemselIdClasse=0000008910&selectItemselIdClasse=0000008730&selectItemselIdClasse=0000100122&selectItemselIdClasse=0000000191&selectItemselIdClasse=0000100051&selectItemselIdClasse=0000000353&selectItemselIdClasse=0000000760&selectItemselIdClasse=0000100135&selectItemselIdClasse=0000100084&selectItemselIdClasse=0000000035&selectItemselIdClasse=0000100022&selectItemselIdClasse=0000100144&selectItemselIdClasse=0000100023&selectItemselIdClasse=0000100024&selectItemselIdClasse=0000000215&selectItemselIdClasse=0000000446&selectItemselIdClasse=0000100025&selectItemselIdClasse=0000100026&selectItemselIdClasse=0000000223&selectItemselIdClasse=0000100087&selectItemselIdClasse=0000100027&selectItemselIdClasse=0000000359&selectItemselIdClasse=0000000475&selectItemselIdClasse=0000000354&selectItemselIdClasse=0000000476&selectItemselIdClasse=0000000355&selectItemselIdClasse=0000000195&selectItemselIdClasse=0000000447&selectItemselIdClasse=0000100145&selectItemselIdClasse=0000100038&selectItemselIdClasse=0000014552&selectItemselIdClasse=0000014567&selectItemselIdClasse=0000014560&selectItemselIdClasse=0000014562&selectItemselIdClasse=0000100152&selectItemselIdClasse=0000100097&selectItemselIdClasse=0000014551&selectItemselIdClasse=0000014569&selectItemselIdClasse=0000014561&selectItemselIdClasse=0000001456&selectItemselIdClasse=0000100151&selectItemselIdClasse=0000100028&selectItemselIdClasse=0000100029&selectItemselIdClasse=0000100096&selectItemselIdClasse=0000100030&selectItemselIdClasse=0000000025&selectItemselIdClasse=0000000405&selIdClasseSelecionados=0000100000%2C0000000452%2C0000000456%2C0000000459%2C0000000003%2C0000000002%2C0000000413%2C0000000001%2C0000100072%2C0000100095%2C0000000006%2C0000000300%2C0000000013%2C0000000388%2C0000000387%2C0000000018%2C0000000301%2C0000000218%2C0000000196%2C0000000416%2C0000000302%2C0000000022%2C0000100037%2C0000000303%2C0000000304%2C0000000305%2C0000000273%2C0000000389%2C0000000411%2C0000000414%2C0000000373%2C0000000374%2C0000000426%2C0000000230%2C0000000171%2C0000000165%2C0000000169%2C0000000306%2C0000000307%2C0000000427%2C0000000428%2C0000000032%2C0000000412%2C0000000308%2C0000000779%2C0000008750%2C0000100057%2C0000000449%2C0000000036%2C0000000450%2C0000100098%2C0000100099%2C0000004350%2C0000000037%2C0000000038%2C0000000390%2C0000000309%2C0000000040%2C0000000310%2C0000000311%2C0000000312%2C0000000313%2C0000100109%2C0000000468%2C0000000203%2C0000000045%2C0000000004%2C0000100001%2C0000000314%2C0000000231%2C0000100002%2C0000000005%2C0000000315%2C0000000048%2C0000000316%2C0000000362%2C0000000050%2C0000100086%2C0000100085%2C0000000317%2C0000100003%2C0000000214%2C0000000052%2C0000100004%2C0000100005%2C0000100118%2C0000000064%2C0000100092%2C0000000318%2C0000000204%2C0000000054%2C0000000055%2C0000100042%2C0000000319%2C0000100119%2C0000000007%2C0000100076%2C0000100112%2C0000000057%2C0000014550%2C0000100158%2C0000000058%2C0000000420%2C0000100055%2C0000005220%2C0000014603%2C0000000445%2C0000000435%2C0000000422%2C0000100063%2C0000100115%2C0000000320%2C0000000407%2C0000000060%2C0000000418%2C0000006020%2C0000014544%2C0000014607%2C0000100054%2C0000000444%2C0000000433%2C0000000424%2C0000000421%2C0000100064%2C0000100133%2C0000000235%2C0000000463%2C0000100132%2C0000000423%2C0000014604%2C0000000061%2C0000000425%2C0000014545%2C0000000419%2C0000000062%2C0000100134%2C0000012820%2C0000008530%2C0000008460%2C0000008470%2C0000008540%2C0000008480%2C0000008490%2C0000008550%2C0000008620%2C0000008570%2C0000008660%2C0000006740%2C0000008590%2C0000006710%2C0000006760%2C0000008600%2C0000006720%2C0000006770%2C0000008610%2C0000006730%2C0000006780%2C0000014520%2C0000000139%2C0000008500%2C0000002480%2C0000014546%2C0000014586%2C0000014587%2C0000014589%2C0000014588%2C0000014590%2C0000014529%2C0000100077%2C0000100155%2C0000000008%2C0000000009%2C0000000321%2C0000000438%2C0000100006%2C0000000322%2C0000000066%2C0000000744%2C0000000746%2C0000014532%2C0000100065%2C0000000216%2C0000100128%2C0000002160%2C0000000358%2C0000000011%2C0000000404%2C0000000010%2C0000100124%2C0000100007%2C0000000232%2C0000000323%2C0000000467%2C0000100149%2C0000000370%2C0000000221%2C0000000250%2C0000000166%2C0000100079%2C0000100080%2C0000000168%2C0000000164%2C0000000170%2C0000000220%2C0000014613%2C0000100083%2C0000100136%2C0000000471%2C0000014559%2C0000014619%2C0000100040%2C0000100008%2C0000000199%2C0000100039%2C0000000068%2C0000000406%2C0000000460%2C0000000219%2C0000000014%2C0000000454%2C0000000070%2C0000000015%2C0000000398%2C0000000016%2C0000000017%2C0000000209%2C0000000208%2C0000000027%2C0000014558%2C0000100009%2C0000100010%2C0000000069%2C0000000399%2C0000100088%2C0000100034%2C0000000071%2C0000000410%2C0000000072%2C0000000408%2C0000000073%2C0000000391%2C0000000357%2C0000000074%2C0000000324%2C0000000325%2C0000100011%2C0000000326%2C0000000078%2C0000000392%2C0000000079%2C0000100157%2C0000014596%2C0000100073%2C0000000364%2C0000000202%2C0000000327%2C0000008850%2C0000000772%2C0000000328%2C0000100137%2C0000000082%2C0000000083%2C0000000084%2C0000000085%2C0000000086%2C0000000087%2C0000000394%2C0000100131%2C0000004690%2C0000004640%2C0000000237%2C0000000252%2C0000000365%2C0000000371%2C0000000088%2C0000000393%2C0000000437%2C0000000089%2C0000003901%2C0000000090%2C0000000091%2C0000000092%2C0000000395%2C0000004630%2C0000000439%2C0000100130%2C0000014531%2C0000002050%2C0000014527%2C0000000239%2C0000000254%2C0000100031%2C0000000211%2C0000000363%2C0000100012%2C0000100102%2C0000100103%2C0000100123%2C0000100093%2C0000000386%2C0000000366%2C0000000198%2C0000000384%2C0000014557%2C0000000094%2C0000000241%2C0000100013%2C0000100138%2C0000000382%2C0000100041%2C0000000095%2C0000000381%2C0000100062%2C0000000096%2C0000000097%2C0000000429%2C0000000098%2C0000000430%2C0000000383%2C0000000385%2C0000000329%2C0000000099%2C0000100139%2C0000100066%2C0000100140%2C0000100141%2C0000100043%2C0000000417%2C0000100100%2C0000100108%2C0000100156%2C0000000100%2C0000000431%2C0000000205%2C0000000477%2C0000000470%2C0000000249%2C0000000101%2C0000000377%2C0000009800%2C0000000102%2C0000100035%2C0000100105%2C0000100053%2C0000100014%2C0000000210%2C0000014601%2C0000000130%2C0000012077%2C0000100081%2C0000003900%2C0000002900%2C0000000020%2C0000001050%2C0000001040%2C0000001030%2C0000000409%2C0000000200%2C0000000103%2C0000000104%2C0000000397%2C0000008790%2C0000007800%2C0000100067%2C0000100044%2C0000000105%2C0000000436%2C0000000513%2C0000014548%2C0000014549%2C0000014595%2C0000014597%2C0000000106%2C0000000107%2C0000000396%2C0000008780%2C0000008820%2C0000008950%2C0000008810%2C0000008890%2C0000008740%2C0000100068%2C0000014621%2C0000014547%2C0000100127%2C0000100147%2C0000100069%2C0000014574%2C0000014570%2C0000014575%2C0000000441%2C0000100110%2C0000014584%2C0000014556%2C0000100126%2C0000100148%2C0000100070%2C0000000110%2C0000000604%2C0000000330%2C0000000415%2C0000100015%2C0000100059%2C0000000440%2C0000100045%2C0000000112%2C0000000824%2C0000000108%2C0000100016%2C0000100017%2C0000100018%2C0000100019%2C0000000113%2C0000100113%2C0000000132%2C0000000458%2C0000100020%2C0000000360%2C0000000461%2C0000000462%2C0000000455%2C0000000114%2C0000000401%2C0000014554%2C0000000115%2C0000000116%2C0000000356%2C0000014555%2C0000000212%2C0000000213%2C0000000331%2C0000000378%2C0000000118%2C0000000375%2C0000000750%2C0000000376%2C0000000832%2C0000008340%2C0000000119%2C0000000379%2C0000100091%2C0000000469%2C0000000380%2C0000000255%2C0000000120%2C0000000121%2C0000000122%2C0000000123%2C0000000124%2C0000000125%2C0000000126%2C0000000332%2C0000000333%2C0000000129%2C0000000334%2C0000000367%2C0000000133%2C0000000243%2C0000000368%2C0000000135%2C0000000138%2C0000000140%2C0000000163%2C0000100078%2C0000100116%2C0000100056%2C0000100117%2C0000000028%2C0000000141%2C0000000335%2C0000000134%2C0000000453%2C0000000143%2C0000000206%2C0000000144%2C0000000400%2C0000000145%2C0000000369%2C0000000372%2C0000000146%2C0000000226%2C0000000227%2C0000000336%2C0000000148%2C0000000149%2C0000001010%2C0000100114%2C0000014582%2C0000000443%2C0000001011%2C0000000150%2C0000100106%2C0000000337%2C0000000153%2C0000000154%2C0000000155%2C0000000156%2C0000100154%2C0000000338%2C0000000152%2C0000100101%2C0000000158%2C0000009310%2C0000014581%2C0000000663%2C0000014598%2C0000000434%2C0000014528%2C0000014521%2C0000014599%2C0000000257%2C0000100153%2C0000100071%2C0000100111%2C0000000246%2C0000014602%2C0000000339%2C0000009388%2C0000000340%2C0000009333%2C0000000217%2C0000100074%2C0000000029%2C0000100082%2C0000100075%2C0000100032%2C0000000432%2C0000000161%2C0000100146%2C0000000247%2C0000000162%2C0000000167%2C0000000228%2C0000100036%2C0000010441%2C0000100061%2C0000100121%2C0000000136%2C0000001012%2C0000100058%2C0000000137%2C0000000457%2C0000000172%2C0000100090%2C0000000341%2C0000100060%2C0000000187%2C0000000342%2C0000014573%2C0000014571%2C0000014572%2C0000100125%2C0000100129%2C0000014583%2C0000014600%2C0000000343%2C0000000451%2C0000100142%2C0000000403%2C0000100046%2C0000100047%2C0000000344%2C0000000474%2C0000000465%2C0000000345%2C0000000346%2C0000000180%2C0000000181%2C0000000448%2C0000100143%2C0000000176%2C0000000466%2C0000000464%2C0000000361%2C0000100048%2C0000100049%2C0000014553%2C0000100021%2C0000100089%2C0000000224%2C0000100120%2C0000100052%2C0000000347%2C0000000348%2C0000000349%2C0000000472%2C0000000473%2C0000000222%2C0000100033%2C0000100104%2C0000000033%2C0000000350%2C0000000186%2C0000000351%2C0000000352%2C0000009445%2C0000009666%2C0000100107%2C0000000190%2C0000000402%2C0000100150%2C0000000442%2C0000000258%2C0000000248%2C0000100050%2C0000000109%2C0000008910%2C0000008730%2C0000100122%2C0000000191%2C0000100051%2C0000000353%2C0000000760%2C0000100135%2C0000100084%2C0000000035%2C0000100022%2C0000100144%2C0000100023%2C0000100024%2C0000000215%2C0000000446%2C0000100025%2C0000100026%2C0000000223%2C0000100087%2C0000100027%2C0000000359%2C0000000475%2C0000000354%2C0000000476%2C0000000355%2C0000000195%2C0000000447%2C0000100145%2C0000100038%2C0000014552%2C0000014567%2C0000014560%2C0000014562%2C0000100152%2C0000100097%2C0000014551%2C0000014569%2C0000014561%2C0000001456%2C0000100151%2C0000100028%2C0000100029%2C0000100096%2C0000100030%2C0000000025%2C0000000405&chkExibirBaixados=on`,
            'application/x-www-form-urlencoded; charset=UTF-8'
        );

        return response?.resultados?.map(res => {
            return `https://eproc1g.tjrs.jus.br/eproc/${res.linkProcessoAssinado}`;
        })
    }

    public async fetchEntityLawsuits(taxID: string): Promise<IEprocLawsuit[]> {
        const result = [];
        await this.fetchEntityLawsuitsStream(taxID, lawsuit => result.push(lawsuit));
        return result.filter(x => x);
    }

    public async fetchEntityLawsuitsStream(taxID: string, onLawsuit: (lws: IEprocLawsuit) => any): Promise<void> {
        const links = await this.fetchEntityLawsuitURLs(taxID);
        for (const link of links) {
            try {
                const lawsuit = await this.fetchDirectLawsuit(link);
                if (lawsuit) {
                    await onLawsuit(lawsuit);
                }
            }
            catch (err) {
                if (!this.skipOnError) {
                    throw err;
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.error(`[EPROC-CRAWLER] Lawsuit ${link} skipped!`, err);
                }
                await sleep(this.sleepTime);
            }
            await sleep(this.sleepTime);
        }
    }

}