"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fiscal = exports.EprocLawsuitProvider = exports.EprocAuthProvider = void 0;
const Fiscal_1 = __importDefault(require("./src/entities/Fiscal"));
exports.Fiscal = Fiscal_1.default;
const EprocAuthProvider_1 = __importDefault(require("./src/EprocAuthProvider"));
exports.EprocAuthProvider = EprocAuthProvider_1.default;
const EprocLawsuitProvider_1 = __importDefault(require("./src/EprocLawsuitProvider"));
exports.EprocLawsuitProvider = EprocLawsuitProvider_1.default;
