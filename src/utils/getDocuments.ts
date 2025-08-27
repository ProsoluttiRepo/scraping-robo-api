import { DocumentosRestritos } from 'src/interfaces';
import { ProcessDocumentType } from 'src/interfaces/process-document.enum';
import { isAfterDate } from './date-validations';
import { normalizeString } from './normalize-string';

const AcordaoEDDoc = (
  acordao: DocumentosRestritos | null,
  acordaoDocs: DocumentosRestritos[],
  movimentacoes: { data: string; descricao: string }[],
): DocumentosRestritos[] => {
  if (!acordao) return [];

  const getTime = (d: string) =>
    new Date(d.split('/').reverse().join('-')).getTime();

  // 1. Pega todas as movimentações "transitado em julgado"
  const transitados = movimentacoes.filter((mov) =>
    /transitado em julgado/i.test(mov.descricao),
  );

  // 2. Ordena por data (caso não venham ordenadas)
  transitados.sort((a, b) => getTime(a.data) - getTime(b.data));

  // 3. Procura o primeiro "transitado em julgado" que NÃO tenha revogação na mesma data
  let dataLimite: number | null = null;
  for (const t of transitados) {
    const mesmaDataRevogada = movimentacoes.some(
      (mov) =>
        getTime(mov.data) === getTime(t.data) &&
        /revogada a decisão anterior/i.test(mov.descricao),
    );

    if (!mesmaDataRevogada) {
      dataLimite = getTime(t.data);
      break; // encontrou o válido, para aqui
    }
  }

  // 4. Filtra todos os documentos posteriores ao acórdão de referência
  let docsFiltrados = acordaoDocs.filter(
    (doc) => getTime(doc.data) > getTime(acordao.data),
  );

  // 5. Se existir data limite, mantém apenas os anteriores
  if (dataLimite) {
    docsFiltrados = docsFiltrados.filter(
      (doc) => getTime(doc.data) < dataLimite,
    );
  }

  // 6. Retorna os documentos ajustando o tipo
  return docsFiltrados.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.AcordaoED,
  }));
};
const getAcordaoValido = (docs: DocumentosRestritos[]) => {
  const acordaos = AcordaoDoc(docs);
  const sentencas = SentencaDoc(docs);

  if (!acordaos.length) return null;

  // Pega o primeiro acórdão ordenado
  let acordaoValido = acordaos[0];

  // Converte datas para timestamp
  const getTime = (d: string) =>
    new Date(d.split('/').reverse().join('-')).getTime();

  // Verifica se existe sentença com data maior que o acórdão encontrado
  const existeSentencaDepois = sentencas.some(
    (sentenca) => getTime(sentenca.data) > getTime(acordaoValido.data),
  );

  if (existeSentencaDepois) {
    // Nesse caso, considera o próximo acórdão como válido
    acordaoValido = acordaos[1] || null;
  }
  if (!acordaoValido) return null;
  return acordaoValido;
};
const PeticaoDoc = (docs: DocumentosRestritos[]) => {
  const doc = docs.find((doc) =>
    normalizeString(doc.titulo).match(/.*peticao.*inicial.*/i),
  );
  if (doc) {
    return {
      ...doc,
      tipo: ProcessDocumentType.PeticaoInicial,
    };
  }
  return null;
};
const AcordaoDoc = (docs: DocumentosRestritos[]) => {
  const acordao = docs
    .filter((doc) => normalizeString(doc.titulo).match(/.*acordao.*/i))
    .filter(
      (doc, index, self) =>
        self.findIndex((d) => d.unique_name === doc.unique_name) === index,
    )
    .sort((a, b) => {
      const dateA = new Date(a?.data.split('/').reverse().join('-')).getTime();
      const dateB = new Date(b?.data.split('/').reverse().join('-')).getTime();
      return dateA - dateB;
    });
  if (!acordao.length) return [];
  return acordao;
};
const AcordaoAP = (
  movements: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentsFound = movements.find(
    (moviment: { data: string; descricao: string; instancia: string }) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(/juntad.*agravo.*peticao.*/i),
  );
  if (!movimentsFound) return null;

  const movimentsFound2 = movements.find(
    (moviment: { data: string; descricao: string; instancia: string }) =>
      moviment.instancia === 'SEGUNDO_GRAU' &&
      normalizeString(moviment.descricao).match(/^(?!.*paradigma).*acordao/i) &&
      isAfterDate(moviment?.data, movimentsFound?.data),
  );
  if (!movimentsFound2) return null;

  const docFound = docs?.find(
    (doc) =>
      normalizeString(doc.titulo).match(/^(?!.*paradigma).*acordao/i) &&
      isAfterDate(movimentsFound.data, doc.data),
  );
  if (!docFound) {
    return null;
  }
  return { ...docFound, tipo: ProcessDocumentType.AcordaoAP };
};
const SentencaDoc = (docs: DocumentosRestritos[]) => {
  const filteredDocs = docs
    .filter((doc) => normalizeString(doc.titulo).match(/.*sentenca.*/i))
    .filter(
      (doc, index, self) =>
        self.findIndex((d) => d.unique_name === doc.unique_name) === index,
    )
    .sort((a, b) => {
      const dateA = new Date(a?.data.split('/').reverse().join('-')).getTime();
      const dateB = new Date(b?.data.split('/').reverse().join('-')).getTime();
      return dateA - dateB;
    });
  if (!filteredDocs.length) return [];
  return filteredDocs.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.SentencaMerito,
  }));
};
const HomologadoDoc = (
  movimentacoes: { data: string; descricao: string; instancia: string }[],
  documents: DocumentosRestritos[],
) => {
  // 1. Busca a movimentação homologada
  const homologadoMoviment = movimentacoes.find((movement) => {
    return (
      movement?.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(movement?.descricao)
        ?.toLowerCase()
        ?.match(/.*homologada (\w )?liquidacao.*/i)
    );
  });

  if (!homologadoMoviment) {
    return null;
  }

  // 2. Busca o documento vinculado à movimentação
  const docFound = documents.find(
    (doc) =>
      (normalizeString(doc.titulo).match(/.*homologacao.*/i) ||
        normalizeString(doc.titulo).match(/.*decisao.*/i)) &&
      doc.instancia === 'PRIMEIRO_GRAU' &&
      doc.data === homologadoMoviment.data,
  );
  if (!docFound) {
    return null;
  }
  return { ...docFound, tipo: ProcessDocumentType.HomologacaoDeCalculo };
};
const SentencaEEAcolhido = (
  movements: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentsFound = movements.find(
    (moviment: { data: string; descricao: string; instancia: string }) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(
        /acolhidos os embargos a execucao de .*/i,
      ),
  );

  if (!movimentsFound) return null;

  const docFounds = docs?.filter(
    (doc: DocumentosRestritos) =>
      normalizeString(doc.titulo).match(/sentenca/i) &&
      isAfterDate(movimentsFound?.data, doc?.data),
  );
  if (!docFounds.length) {
    return null;
  }
  return docFounds.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.SentencaEE,
  })) as DocumentosRestritos[];
};
const EmendaInicialDoc = (docs: DocumentosRestritos[]) => {
  const doc = docs.find((doc) =>
    normalizeString(doc.titulo).match(/.*emenda.*inicial.*/i),
  );
  if (doc) {
    return {
      ...doc,
      tipo: ProcessDocumentType.EmendaAInicial,
    };
  }
  return null;
};
const DecisaoDoc = (docs: DocumentosRestritos[]) => {
  const doc = docs.filter((doc) =>
    normalizeString(doc.titulo).match(/.*decisao.*/i),
  );
  if (!doc) {
    return null;
  }
  return doc.map((d) => ({
    ...d,
    tipo: ProcessDocumentType.Decisao,
  })) as DocumentosRestritos[];
};
const PlanilhaCalculoDocs = (docs: DocumentosRestritos[]) => {
  const doc = docs.filter((doc) =>
    normalizeString(doc.titulo).match(/.*calculo.*/),
  );
  if (!doc) {
    return null;
  }
  return doc.map((d) => ({
    ...d,
    tipo: ProcessDocumentType.PlanilhaCalculo,
  })) as DocumentosRestritos[];
};
const RecursoRevistaDoc = (
  movimentacoes: { data: string; descricao: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentFound = movimentacoes.find((movimentacao) => {
    return normalizeString(movimentacao.descricao).match(
      /juntada.*peticao de recurso de revista/i,
    );
  });

  if (!movimentFound) return null;

  const docFound = docs?.find(
    (doc) =>
      normalizeString(doc.titulo).match(/recurso de revista/i) &&
      movimentFound?.data === doc?.data,
  );

  if (!docFound) return null;
  const hasGarantia = docs.find((doc) => {
    return (
      doc.titulo &&
      (doc.titulo.match(/.*deposito.* .*judicial.*/i) ||
        doc.titulo.match(/.*deposito.* .*recursal.*/i) ||
        doc.titulo.match(/apolice/i) ||
        doc.titulo.match(/susep/i) ||
        doc.titulo.match(/garantia judicial/i))
    );
  });
  return {
    ...docFound,
    tipo: hasGarantia
      ? ProcessDocumentType.RRReclamada
      : ProcessDocumentType.RecursoDeRevista,
  };
};
const AdmissibilidadeRRDoc = (
  movimentacoes: { data: string; descricao: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentFound =
    movimentacoes.find((movimentacao) => {
      return movimentacao.descricao.match(
        /.*nao admitido o recurso de revista de.*/i,
      );
    }) ||
    movimentacoes.find((movimentacao) => {
      return movimentacao.descricao.match(
        /.*admitido em parte o recurso de revista de.*/i,
      );
    }) ||
    movimentacoes.find((movimentacao) => {
      return movimentacao.descricao.match(
        /.*admitido o recurso de revista de.*/i,
      );
    });

  if (!movimentFound) return null;

  const docFound = docs?.find(
    (doc) =>
      normalizeString(doc.titulo).match(/recurso de revista/i) &&
      movimentFound?.data === doc?.data,
  );
  if (!docFound) return null;
  return { ...docFound, tipo: ProcessDocumentType.AdmissibilidadeRR };
};
const SentencaEDDoc = (
  movements: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentEmbargosFound = movements.find(
    (moviment) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(/.*embargos de declaracao.*/i),
  );

  if (!movimentEmbargosFound) return null;

  const movimentsFound = movements.filter(
    (moviment) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(
        /.*sentenca.*embargos.*declaracao.*/i,
      ) &&
      isAfterDate(movimentEmbargosFound?.data, moviment?.data),
  );

  if (!movimentsFound.length) return null;

  const docsToReturn: DocumentosRestritos[] = [];
  movimentsFound.forEach((movimentFound) => {
    const docFound = docs.find(
      (doc) => doc.titulo && movimentFound?.data === doc?.data,
    );
    if (docFound) {
      docsToReturn.push(docFound);
    }
  });
  return docsToReturn.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.SentencaED,
  })) as DocumentosRestritos[];
};
const SentencaEEDoc = (
  movements: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentsFound = movements.find(
    (moviment) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(
        /acolhidos os embargos a execucao de .*/i,
      ),
  );

  if (!movimentsFound) return null;

  const docFounds = docs?.filter(
    (doc) =>
      normalizeString(doc.titulo).match(/sentenca/i) &&
      isAfterDate(movimentsFound?.data, doc?.data),
  );
  if (!docFounds.length) {
    return null;
  }
  return docFounds.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.SentencaEE,
  })) as DocumentosRestritos[];
};
const AcordaoAPDoc = (
  movements: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentsFound = movements.find(
    (moviment) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(/juntad.*agravo.*peticao.*/i),
  );
  if (!movimentsFound) return null;

  const movimentsFound2 = movements.find(
    (moviment) =>
      moviment.instancia === 'SEGUNDO_GRAU' &&
      normalizeString(moviment.descricao).match(/^(?!.*paradigma).*acordao/i) &&
      isAfterDate(moviment?.data, movimentsFound?.data),
  );
  if (!movimentsFound2) return null;

  const docFound = docs?.find(
    (doc) =>
      normalizeString(doc.titulo).match(/^(?!.*paradigma).*acordao/i) &&
      isAfterDate(movimentsFound.data, doc.data),
  );
  if (!docFound) {
    return null;
  }
  return { ...docFound, tipo: ProcessDocumentType.AcordaoAP };
};
const RRAPDoc = (
  movimentacoes: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentFound = movimentacoes.find((movimentacao) => {
    return normalizeString(movimentacao.descricao).match(
      /.*agravo de peticao.*/i,
    );
  });

  if (!movimentFound) return null;

  const docFounds = docs?.filter(
    (doc) =>
      normalizeString(doc.titulo).match(/recurso de revista/i) &&
      isAfterDate(movimentFound?.data, doc?.data),
  );
  if (!docFounds.length) return null;
  return docFounds.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.RRAP,
  })) as DocumentosRestritos[];
};
const ImpugnacaoDoc = (
  movements: { data: string; descricao: string; instancia: string }[],
  docs: DocumentosRestritos[],
) => {
  const movimentsFound = movements.find(
    (moviment) =>
      moviment.instancia === 'PRIMEIRO_GRAU' &&
      normalizeString(moviment.descricao).match(
        /juntada.*peticao.*impugnacao.*sentenca.*liquidacao.*/i,
      ),
  );

  if (!movimentsFound) return null;

  const docFound = docs?.find(
    (doc) =>
      normalizeString(doc.titulo).match(/impugnacao.*sentenca.*liquidacao/i) &&
      isAfterDate(doc?.data, movimentsFound?.data),
  );
  if (!docFound) return null;
  return { ...docFound, tipo: ProcessDocumentType.Impugnacao };
};
export {
  AcordaoAP,
  AcordaoDoc,
  AcordaoEDDoc,
  AdmissibilidadeRRDoc,
  DecisaoDoc,
  EmendaInicialDoc,
  getAcordaoValido,
  HomologadoDoc,
  PeticaoDoc,
  PlanilhaCalculoDocs,
  RecursoRevistaDoc,
  SentencaDoc,
  SentencaEEAcolhido,
  SentencaEDDoc,
  SentencaEEDoc,
  AcordaoAPDoc,
  RRAPDoc,
  ImpugnacaoDoc,
};
