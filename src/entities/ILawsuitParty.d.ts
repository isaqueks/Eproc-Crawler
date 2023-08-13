import { TipoPessoa } from "./Fiscal";
export interface IEprocLaswuitParty {
    name: string;
    taxID: string;
    type: TipoPessoa;
}
