"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipoPessoa = void 0;
const validateit_1 = require("validateit");
var TipoPessoa;
(function (TipoPessoa) {
    TipoPessoa["F"] = "F\u00EDsica";
    TipoPessoa["J"] = "Jur\u00EDdica";
})(TipoPessoa = exports.TipoPessoa || (exports.TipoPessoa = {}));
class Fiscal {
    static tipoPessoa(documento) {
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
    static descricaoTipo(tipo) {
        return tipo.toString();
    }
    static formaAbreviada(tipo) {
        return Fiscal.descricaoTipo(tipo)[0];
    }
}
exports.default = Fiscal;
Fiscal.cpfValidation = new validateit_1.CpfValidation();
Fiscal.cnpjValidation = new validateit_1.CnpjValidation();
