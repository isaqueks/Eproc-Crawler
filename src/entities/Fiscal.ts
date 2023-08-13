import { CpfValidation, CnpjValidation } from "validateit";

export enum TipoPessoa {
    F = 'Física',
    J = 'Jurídica'
}

export default class Fiscal {

    protected static cpfValidation: CpfValidation = new CpfValidation();
    protected static cnpjValidation: CnpjValidation = new CnpjValidation();

    public static tipoPessoa(documento: string): TipoPessoa {
        if (this.cpfValidation.validate(documento)) {
            return TipoPessoa.F;
        }
        else if (this.cnpjValidation.validate(documento)) {
            return TipoPessoa.J;
        }
        else {
            throw new Error(`Invalid document "${documento}"!`);
        }
    }

    public static descricaoTipo(tipo: TipoPessoa): 'Física' | 'Jurídica' {
        return tipo.toString() as 'Física' | 'Jurídica';
    }

    public static formaAbreviada(tipo: TipoPessoa): 'F' | 'J' {
        return Fiscal.descricaoTipo(tipo)[0] as any;
    }

}