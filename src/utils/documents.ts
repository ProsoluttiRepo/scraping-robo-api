import { DocumentosRestritos, ItensProcesso } from 'src/interfaces';
import { ProcessDocumentType } from 'src/interfaces/process-document.enum';
import {
  AcordaoAP,
  AcordaoAPDoc,
  AcordaoDoc,
  AcordaoEDDoc,
  AdmissibilidadeRRDoc,
  DecisaoDoc,
  getAcordaoValido,
  HomologadoDoc,
  ImpugnacaoDoc,
  PeticaoDoc,
  PlanilhaCalculoDocs,
  RecursoRevistaDoc,
  SentencaDoc,
  SentencaEDDoc,
  SentencaEEAcolhido,
  SentencaEEDoc,
} from './getDocuments';

export const normalizeDocsResponse = (
  regionTRT: number,
  docs?: ItensProcesso[],
): DocumentosRestritos[] => {
  if (!docs || !docs.length) return [];
  const docsFound: DocumentosRestritos[] = [];
  const itensProcessoDocs: DocumentosRestritos[] =
    docs
      ?.filter((item) => item.documento)
      ?.map((item, index) => ({
        posicao_id: index + 1,
        titulo: item.tipo,
        descricao: item.titulo,
        data: new Intl.DateTimeFormat('pt-BR').format(new Date(item.data)),
        unique_name: `trt${regionTRT}-PJE-${item.idUnicoDocumento}`,
        instancia: item.instancia,
        idUnicoDocumento: item.idUnicoDocumento,
        instanciaId: item.instanciaId,
        documentoId: item.id,
      })) || [];

  const movimentacoes =
    (docs ?? []).map((item) => ({
      data: new Intl.DateTimeFormat('pt-BR').format(new Date(item.data)),
      descricao: item.titulo,
      instancia: item.instancia,
    })) || [];
  //DOCUMENTO DE PETIÇÃO INICIAL
  const peticaoInicialDoc = PeticaoDoc(
    itensProcessoDocs,
  ) as DocumentosRestritos;
  if (peticaoInicialDoc) {
    docsFound.push(peticaoInicialDoc);
  }
  // DOCUMENTO DE SENTENÇA
  const sentencaDoc = SentencaDoc(itensProcessoDocs);
  if (sentencaDoc.length) {
    docsFound.push(...sentencaDoc);
  }
  // DOCUMENTO DE ACORDÃO(MÉRITO/TRT)
  const acordaoDoc = getAcordaoValido(itensProcessoDocs) as DocumentosRestritos;
  if (acordaoDoc) {
    docsFound.push(
      { ...acordaoDoc, tipo: ProcessDocumentType.Acordao },
      { ...acordaoDoc, tipo: ProcessDocumentType.AcordaoTRT },
    );
  }

  // DOCUMENTO DE ACORDÃO E ACORDÃO ED
  const acordaoEDDoc = AcordaoEDDoc(
    acordaoDoc,
    AcordaoDoc(itensProcessoDocs),
    movimentacoes,
  );
  if (acordaoEDDoc.length) {
    docsFound.push(...acordaoEDDoc);
  }

  // DOCUMENTO DE PLANILHA DE CÁLCULO
  const planilhasCalculoDocs = PlanilhaCalculoDocs(itensProcessoDocs);
  if (planilhasCalculoDocs) {
    docsFound.push(...planilhasCalculoDocs);
  }
  // DOCUMENTO DE DESCISÃO
  const decisaoDoc = DecisaoDoc(itensProcessoDocs);
  if (decisaoDoc) {
    docsFound.push(...decisaoDoc);
  }
  // DOCUMENTO HOMOLOGADO
  const homologadoDoc = HomologadoDoc(movimentacoes, itensProcessoDocs);

  if (homologadoDoc) {
    docsFound.push(homologadoDoc);
  }
  const acordaoAPDoc = AcordaoAP(movimentacoes, itensProcessoDocs);
  if (acordaoAPDoc) {
    docsFound.push(acordaoAPDoc);
  }
  const sentencaEEAcolhidoDocs = SentencaEEAcolhido(
    movimentacoes,
    itensProcessoDocs,
  );
  if (sentencaEEAcolhidoDocs && sentencaEEAcolhidoDocs.length) {
    docsFound.push(...sentencaEEAcolhidoDocs);
  }
  const recursoRevistaDoc = RecursoRevistaDoc(movimentacoes, itensProcessoDocs);
  if (recursoRevistaDoc) {
    docsFound.push(recursoRevistaDoc);
  }
  const admissibilidadeRRDoc = AdmissibilidadeRRDoc(
    movimentacoes,
    itensProcessoDocs,
  );
  if (admissibilidadeRRDoc) {
    docsFound.push(admissibilidadeRRDoc);
  }
  const sentencaEDDoc = SentencaEDDoc(movimentacoes, itensProcessoDocs);
  if (sentencaEDDoc) {
    docsFound.push(...sentencaEDDoc);
  }
  const sentencaEEDoc = SentencaEEDoc(movimentacoes, itensProcessoDocs);
  if (sentencaEEDoc) {
    docsFound.push(...sentencaEEDoc);
  }
  const acordaoAPDocs = AcordaoAPDoc(movimentacoes, itensProcessoDocs);
  if (acordaoAPDocs) {
    docsFound.push(acordaoAPDocs);
  }
  const impugnacaoDoc = ImpugnacaoDoc(movimentacoes, itensProcessoDocs);
  if (impugnacaoDoc) {
    docsFound.push(impugnacaoDoc);
  }
  return docsFound;
};
