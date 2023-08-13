import IEprocLawsuit from "./entities/IEprocLawsuit";
export default class EprocLawsuitParser {
    private readonly page;
    private readonly otherPartiesAjax;
    private static readonly TAX_ID_VALIDATION;
    constructor(page: Document, otherPartiesAjax: string);
    private selectHeader;
    private selectParticipants;
    private parseHeader;
    private parseParticipantColumn;
    private parseParticipants;
    private selectEvents;
    private parseEvent;
    parseLawsuit(): IEprocLawsuit;
}
