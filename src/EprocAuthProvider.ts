import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import https from 'https';
import getCookieHeader from './helpers/getCookieHeader';
import Defaults from './defaults';

const BASE_URL = 'https://eproc1g.tjrs.jus.br/';

export default class EprocAuthProvider {

    private cachedCertificate: Buffer;

    private authCookies: Map<string, string>;
    private homeURL: string;
    private agent: https.Agent;

    constructor(
        private readonly pfxCertificatePath: string,
        private readonly password: string,
        private readonly crawlingUA: string = Defaults.crawlingUA
    ) {
    }

    public get sessionCookies(): Map<string, string> {
        return this.authCookies;
    }

    public get hashedHomeURL(): string {
        return this.homeURL;
    }


    public getCookieHeader(): string {
        return getCookieHeader(this.authCookies);
    }

    protected getBaseHeaders() {
        return {
            'User-Agent': this.crawlingUA,
            'Host': 'eproc1g.tjrs.jus.br'
        }
    }

    private async readCertificate(): Promise<Buffer> {
        return await fs.promises.readFile(this.pfxCertificatePath);
    }

    private async getCertificate(): Promise<Buffer> {
        
        if (!this.cachedCertificate) {
            this.cachedCertificate = await this.readCertificate();
        }

        return this.cachedCertificate;
    }

    private async getHttpsAgnent(): Promise<https.Agent> {
        if (this.agent) {
            return this.agent;
        }

        const certificate = await this.getCertificate();
        this.agent = new https.Agent({
            pfx: certificate,
            passphrase: this.password
        });

        return this.agent;
    }

    public async authenticate() {

        const res = await axios.get(BASE_URL + 'eproc/lib/priv/login_cert.php?acao_origem=', {
            httpsAgent: await this.getHttpsAgnent(),
            maxRedirects: 0,
            headers: this.getBaseHeaders(),
            validateStatus: status => status === 302
        });

        const nextStep = res.headers['location'];
        if (nextStep !== '../../externo_controlador.php?acao=entrar_cert') {
            throw new Error('Unexpected redirect');
        }

        this.authCookies = new Map();

        for (const cookies of res.headers['set-cookie']) {
            const cookie = cookies.split(';')[0];
            const [key, value] = cookie.split('=');
            this.authCookies.set(key, value);
        }

        const homeResponse = await axios.get(BASE_URL + 'eproc/externo_controlador.php?acao=entrar_cert', {
            headers: {
                ...this.getBaseHeaders(),
                Cookie: this.getCookieHeader()
            }
        });

        const { path } = homeResponse.request;
        if (!path.includes('hash=')) {
            throw new Error(`Hash is missing: ${path}`);
        }

        this.homeURL = BASE_URL + path.substring(1);

    }

}