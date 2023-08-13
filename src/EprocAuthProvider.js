"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const getCookieHeader_1 = __importDefault(require("./helpers/getCookieHeader"));
const defaults_1 = __importDefault(require("./defaults"));
const BASE_URL = 'https://eproc1g.tjrs.jus.br/';
class EprocAuthProvider {
    constructor(pfxCertificatePath, password, crawlingUA = defaults_1.default.crawlingUA) {
        this.pfxCertificatePath = pfxCertificatePath;
        this.password = password;
        this.crawlingUA = crawlingUA;
    }
    get sessionCookies() {
        return this.authCookies;
    }
    get hashedHomeURL() {
        return this.homeURL;
    }
    getCookieHeader() {
        return (0, getCookieHeader_1.default)(this.authCookies);
    }
    getBaseHeaders() {
        return {
            'User-Agent': this.crawlingUA,
            'Host': 'eproc1g.tjrs.jus.br'
        };
    }
    readCertificate() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield fs_1.default.promises.readFile(this.pfxCertificatePath);
        });
    }
    getCertificate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.cachedCertificate) {
                this.cachedCertificate = yield this.readCertificate();
            }
            return this.cachedCertificate;
        });
    }
    getHttpsAgnent() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.agent) {
                return this.agent;
            }
            const certificate = yield this.getCertificate();
            this.agent = new https_1.default.Agent({
                pfx: certificate,
                passphrase: this.password
            });
            return this.agent;
        });
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield axios_1.default.get(BASE_URL + 'eproc/lib/priv/login_cert.php?acao_origem=', {
                httpsAgent: yield this.getHttpsAgnent(),
                maxRedirects: 0,
                headers: this.getBaseHeaders(),
                validateStatus: status => status === 302
            });
            const nextStep = res.headers['location'];
            if (nextStep !== '../../externo_controlador.php?acao=entrar_cert') {
                throw new Error('Unexpected redirect');
            }
            this.authCookies = new Map();
            for (const cookies of res.headers['set-cookie']) {
                const cookie = cookies.split(';')[0];
                const [key, value] = cookie.split('=');
                this.authCookies.set(key, value);
            }
            const homeResponse = yield axios_1.default.get(BASE_URL + 'eproc/externo_controlador.php?acao=entrar_cert', {
                headers: Object.assign(Object.assign({}, this.getBaseHeaders()), { Cookie: this.getCookieHeader() })
            });
            const { path } = homeResponse.request;
            if (!path.includes('hash=')) {
                throw new Error(`Hash is missing: ${path}`);
            }
            this.homeURL = BASE_URL + path.substring(1);
        });
    }
}
exports.default = EprocAuthProvider;
