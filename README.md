# Eproc-Crawler
Client do Eproc - TJRS para NodeJS.     

### Instalação
```npm i https://github.com/isaqueks/Eproc-Crawler.git#release```   

### Exemplo de uso    

```typescript
import path from 'path';
import EprocAuthProvider from "../src/EprocAuthProvider";
import EprocLawsuitProvider from "../src/EprocLawsuitProvider";

const CERT_PATH = path.join(__dirname, './EprocCert.pfx');
const CERT_PASS = 'Senha do certificado';
const DOC_ALVO = 'CPF ou CNPJ do alvo, sem pontuação';

const auth = new EprocAuthProvider(CERT_PATH, CERT_PASS);
const provider = new EprocLawsuitProvider(auth);

provider.fetchEntityLawsuitsStream(DOC_ALVO, lawsuit => console.log(lawsuit));    
```

### Estrutura do processo
```typescript
interface IEprocLawsuit {

    id?: number;
    number: string;
    date: Date;
    situation: string;
    court: string;
    judge: string;
    competence: string;
    actionClass: string;

    authors: IEprocLaswuitParty[];

    defendants: IEprocLaswuitParty[];

    events: IEprocLawsuitEvent[];

}

interface IEprocLawsuitEvent {
    id?: number;
    lawsuitNumber: string;
    date: Date;
    description: string;
    documents: string[];
}

interface IEprocLaswuitParty {
    name: string;
    taxID: string;
    type: TipoPessoa;
}
```    

#### Nota
Esse projeto não possui nenhuma ligação com o TJRS, apenas implementa um client/crawler para uso automatizado.