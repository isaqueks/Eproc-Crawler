"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
const Time_1 = __importDefault(require("./helpers/Time"));
const validateit_1 = require("validateit");
const Fiscal_1 = __importDefault(require("./entities/Fiscal"));
/* Auxiliary functions */
const text = e => e === null || e === void 0 ? void 0 : e.textContent;
const parseDate = e => Time_1.default.parseDDMMYYYY(text(e).split(' ')[0]);
const parseCompleteEprocDate = (e) => {
    const [date, time] = text(e).split(' ');
    const [hrs, mins] = time.split(':');
    return new Date(Number(Time_1.default.parseDDMMYYYY(date)) +
        Number(Time_1.default.fromHours(hrs)) +
        Number(Time_1.default.fromMinutes(mins)));
};
class EprocLawsuitParser {
    constructor(page, otherPartiesAjax) {
        this.page = page;
        this.otherPartiesAjax = otherPartiesAjax;
    }
    selectHeader(dom) {
        return dom.querySelector('#fldCapa');
    }
    selectParticipants(dom) {
        return dom.querySelector('#fldPartes');
    }
    parseHeader(element) {
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
        };
    }
    parseParticipantColumn(element, index = 0) {
        const nameRaw = element.querySelector('.infraNomeParte');
        const docRaw = element.querySelector('#spnCpfParteAutor' + index) ||
            element.querySelector('#spnCpfParteReu' + index);
        const doc = EprocLawsuitParser.TAX_ID_VALIDATION.cleanMaskAndValidate(text(docRaw));
        const tipo = doc && Fiscal_1.default.tipoPessoa(doc);
        return {
            name: text(nameRaw),
            taxID: doc,
            type: tipo
        };
    }
    parseParticipants(element) {
        const [authorElement, defendantElement] = [...element.querySelector('.infraTrClara').children];
        const authors = [this.parseParticipantColumn(authorElement)];
        const defendants = [this.parseParticipantColumn(defendantElement)];
        if (this.otherPartiesAjax) {
            try {
                const rawHtml = this.otherPartiesAjax;
                const otherPartiesElement = new jsdom_1.JSDOM(`<html><body>${rawHtml}</body></html>`).window.document.body;
                defendants.push(this.parseParticipantColumn(otherPartiesElement.querySelector('fieldset#fldPartes'), 1));
            }
            catch (err) {
                console.error(err);
            }
        }
        return {
            authors,
            defendants
        };
    }
    selectEvents(dom) {
        return [...dom.querySelectorAll('*[id^="trEvento"]')];
    }
    parseEvent(element, lwNumber) {
        const [indexRaw, dateRaw, descriptionRaw, userRaw, documentsRaw] = [...element.children];
        const date = parseCompleteEprocDate(dateRaw);
        const description = text(descriptionRaw);
        return {
            date: date,
            description,
            lawsuitNumber: lwNumber,
            documents: []
        };
    }
    parseLawsuit() {
        const headerElement = this.selectHeader(this.page);
        const header = this.parseHeader(headerElement);
        const participantsElement = this.selectParticipants(this.page);
        const participants = this.parseParticipants(participantsElement);
        const eventsElement = this.selectEvents(this.page);
        const events = eventsElement.map(e => this.parseEvent(e, header.number));
        return Object.assign(Object.assign(Object.assign({}, header), participants), { events });
    }
}
exports.default = EprocLawsuitParser;
EprocLawsuitParser.TAX_ID_VALIDATION = new validateit_1.DocumentValidation();
