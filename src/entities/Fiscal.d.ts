import { CpfValidation, CnpjValidation } from "validateit";
export declare enum TipoPessoa {
    F = "F\u00EDsica",
    J = "Jur\u00EDdica"
}
export default class Fiscal {
    protected static cpfValidation: CpfValidation;
    protected static cnpjValidation: CnpjValidation;
    static tipoPessoa(documento: string): TipoPessoa;
    static descricaoTipo(tipo: TipoPessoa): 'Física' | 'Jurídica';
    static formaAbreviada(tipo: TipoPessoa): 'F' | 'J';
}
