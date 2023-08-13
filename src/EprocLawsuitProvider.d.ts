import IEprocLawsuit from "./entities/IEprocLawsuit";
import EprocAuthProvider from "./EprocAuthProvider";
export default class EprocLawsuitProvider {
    private readonly authProvider;
    private readonly crawlingUA;
    private readonly skipOnError;
    private readonly sleepTime;
    constructor(authProvider: EprocAuthProvider, crawlingUA?: string, skipOnError?: boolean, sleepTime?: number);
    private getHomeURL;
    private fetchSessionCookies;
    private get;
    private post;
    private fetchOtherPartiesHTML;
    private parseLawsuitFromHTML;
    fetchDirectLawsuit(url: string): Promise<IEprocLawsuit>;
    private fetchLawsuitSearchPage;
    private getLawsuitURL;
    fetchLawsuit(number: string): Promise<IEprocLawsuit>;
    fetchEntityLawsuitURLs(taxID: string): Promise<string[]>;
    fetchEntityLawsuits(taxID: string): Promise<IEprocLawsuit[]>;
    fetchEntityLawsuitsStream(taxID: string, onLawsuit: (lws: IEprocLawsuit) => any): Promise<void>;
}
