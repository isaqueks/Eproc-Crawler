import { TipoPessoa } from "./Fiscal";
export default interface IEprocLaswuitParty {
    name: string;
    taxID: string;
    type: TipoPessoa;
}
