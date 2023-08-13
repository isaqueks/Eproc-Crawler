export default class EprocAuthProvider {
    private readonly pfxCertificatePath;
    private readonly password;
    private readonly crawlingUA;
    private cachedCertificate;
    private authCookies;
    private homeURL;
    private agent;
    constructor(pfxCertificatePath: string, password: string, crawlingUA?: string);
    get sessionCookies(): Map<string, string>;
    get hashedHomeURL(): string;
    getCookieHeader(): string;
    protected getBaseHeaders(): {
        'User-Agent': string;
        Host: string;
    };
    private readCertificate;
    private getCertificate;
    private getHttpsAgnent;
    authenticate(): Promise<void>;
}
