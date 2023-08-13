import IEprocLawsuitEvent from "./IEprocLawsuitEvent";
import IEprocLaswuitParty from "./IEprocLawsuitParty";

export default interface IEprocLawsuit {

    id?: number;
    number: string;
    date: Date;
    situation: string;
    court: string;
    judge: string;
    competence: string;
    actionClass: string;

    authors: IEprocLaswuitParty[];

    defendants: IEprocLaswuitParty[];

    events: IEprocLawsuitEvent[];

}