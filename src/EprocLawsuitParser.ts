import { JSDOM } from "jsdom";
import Time from "./helpers/Time";
import IEprocLawsuitEvent from "./entities/IEprocLawsuitEvent";
import IEprocLawsuit from "./entities/IEprocLawsuit";
import { DocumentValidation } from "validateit";
import Fiscal from "./entities/Fiscal";


/* Auxiliary functions */
const text = e => e?.textContent;
const parseDate = e => Time.parseDDMMYYYY(text(e).split(' ')[0]);
const parseCompleteEprocDate = (e: Element) => {
    const [ date, time ] = text(e).split(' ');
    const [ hrs, mins ] = time.split(':');
    return new Date(
        Number(Time.parseDDMMYYYY(date)) + 
        Number(Time.fromHours(hrs)) + 
        Number(Time.fromMinutes(mins))
    );
}

export default class EprocLawsuitParser {

    private static readonly TAX_ID_VALIDATION: DocumentValidation = new DocumentValidation();

    constructor(
        private readonly page: Document,
        private readonly otherPartiesAjax: string
    ) {
    }

    private selectHeader(dom: Document): HTMLElement {
        return dom.querySelector('#fldCapa');
    }

    private selectParticipants(dom: Document): HTMLElement {
        return dom.querySelector('#fldPartes');
    }

    private parseHeader(element: HTMLElement) {

        const numberRaw = element.querySelector('#txtNumProcesso');
        const autuacaoRaw = element.querySelector('#txtAutuacao');
        const situacaoRaw = element.querySelector('#txtSituacao');
        const courtRaw = element.querySelector('#txtOrgaoJulgador');
        const judgeRaw = element.querySelector('#txtMagistrado');
        const competenceRaw = element.querySelector('#txtCompetencia');
        const actionClassRaw = element.querySelector('#txtClasse');

        return {
            number: numberRaw.textContent.replace(/(\.|\-)/g, ''),
            date: parseDate(autuacaoRaw),
            situation: text(situacaoRaw),
            court: text(courtRaw),
            judge: text(judgeRaw),
            competence: text(competenceRaw),
            actionClass: text(actionClassRaw)
        }

    }

    private parseParticipantColumn(element: HTMLElement, index: number = 0) {

        const nameRaw = element.querySelector('.infraNomeParte');
        const docRaw = 
            element.querySelector('#spnCpfParteAutor'+index) ||
            element.querySelector('#spnCpfParteReu'+index);

        const doc = EprocLawsuitParser.TAX_ID_VALIDATION.cleanMaskAndValidate(text(docRaw));

        const tipo = doc && Fiscal.tipoPessoa(doc);

        return {
            name: text(nameRaw),
            taxID: doc,
            type: tipo
        }

    }

    private parseParticipants(element: HTMLElement) {
        const [ authorElement, defendantElement ] = 
        [...element.querySelector('.infraTrClara').children];

        const authors = [this.parseParticipantColumn(authorElement as any)];
        const defendants = [this.parseParticipantColumn(defendantElement as any)];

        if (this.otherPartiesAjax) {
            try {

                const rawHtml = this.otherPartiesAjax;

                const otherPartiesElement = new JSDOM(`<html><body>${rawHtml}</body></html>`).window.document.body;
                defendants.push(this.parseParticipantColumn(otherPartiesElement.querySelector('fieldset#fldPartes') as any, 1));
            }
            catch (err) {
                console.error(err);
            }
        }

        return {
            authors,
            defendants
        }
    }

    private selectEvents(dom: Document): HTMLElement[] {
        return [...dom.querySelectorAll('*[id^="trEvento"]')] as HTMLElement[];
    }

    private parseEvent(element: HTMLElement, lwNumber: string): IEprocLawsuitEvent {
        const [ indexRaw, dateRaw, descriptionRaw, userRaw, documentsRaw ] = [...element.children];
        const date = parseCompleteEprocDate(dateRaw);
        const description = text(descriptionRaw);
        
        return {
            date: date,
            description,
            lawsuitNumber: lwNumber,
            documents: []
        }
    }

    public parseLawsuit(): IEprocLawsuit {
        const headerElement = this.selectHeader(this.page);
        const header = this.parseHeader(headerElement);

        const participantsElement = this.selectParticipants(this.page);
        const participants = this.parseParticipants(participantsElement);

        const eventsElement = this.selectEvents(this.page);
        const events = eventsElement.map(e => this.parseEvent(e, header.number));
        
        return {
            ...header,
            ...participants,
            events
        }
    }

}