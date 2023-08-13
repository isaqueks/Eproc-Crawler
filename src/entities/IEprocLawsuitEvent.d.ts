export default interface IEprocLawsuitEvent {
    id?: number;
    lawsuitNumber: string;
    date: Date;
    description: string;
    documents: string[];
}
