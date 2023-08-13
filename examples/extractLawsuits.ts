import path from 'path';
import EprocAuthProvider from "../src/EprocAuthProvider";
import EprocLawsuitProvider from "../src/EprocLawsuitProvider";

const CERT_PATH = path.join(__dirname, './EprocCert.pfx');
const CERT_PASS = 'Senha do certificado';
const DOC_ALVO = 'CPF ou CNPJ do alvo, sem pontuação';

const auth = new EprocAuthProvider(CERT_PATH, CERT_PASS);
const provider = new EprocLawsuitProvider(auth);

provider.fetchEntityLawsuitsStream(DOC_ALVO, lawsuit => console.log(lawsuit));