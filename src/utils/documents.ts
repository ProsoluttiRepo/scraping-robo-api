import { DocumentosRestritos, ItensProcesso } from 'src/interfaces';
import { normalizeString } from './normalize-string';
import { ProcessDocumentType } from 'src/interfaces/process-document.enum';

export const normalizeDocsResponse = (
  regionTRT: number,
  docs?: ItensProcesso[],
): DocumentosRestritos[] => {
  const itensProcessoDocs: DocumentosRestritos[] = docs
    ?.filter((item) => item.documento)
    .map((item, index) => {
      return {
        posicao_id: index + 1,
        titulo: item.tipo,
        descricao: item.titulo,
        data: new Intl.DateTimeFormat('pt-BR').format(new Date(item.data)),
        unique_name: `trt${regionTRT}-PJE-${item.idUnicoDocumento}`,
        instancia: item.instancia,
        instanciaId: item.instanciaId,
        documentoId: item.id,
      };
    }) as DocumentosRestritos[];

  //DOCUMENTO DE PETIÇÃO INICIAL
  const peticaoInicialDoc = peticaoDoc(
    itensProcessoDocs,
  ) as DocumentosRestritos;

  // DOCUMENTO DE SENTENÇA
  const sentencaDoc = SentencaDoc(itensProcessoDocs);

  // DOCUMENTO DE ACORDÃO(MÉRITO/TRT)
  const acordaoDoc = getAcordaoValido(itensProcessoDocs) as DocumentosRestritos;

  // DOCUMENTO DE ACORDÃO E ACORDÃO ED
  const acordaoEDDoc = getDocsAcordaoED(
    acordaoDoc,
    AcordaoDoc(itensProcessoDocs),
    (docs ?? []).map((item) => ({
      data: new Intl.DateTimeFormat('pt-BR').format(new Date(item.data)),
      descricao: item.titulo,
    })),
  );

  const docsFound: DocumentosRestritos[] = [
    peticaoInicialDoc,
    acordaoDoc,
    // ...acordaoEDDoc,
    // ...sentencaDoc,
  ];
  return docsFound;
};

/**
 * Filtra e transforma uma lista de documentos restritos, retornando apenas aqueles
 * cuja data é posterior ao documento 'acordao' fornecido e, se houver uma movimentação
 * "transitado em julgado" sem "revogada a decisão anterior" na mesma data, apenas os documentos
 * anteriores a essa data limite. Os documentos retornados são mapeados para ter o tipo definido como 'AcordaoED'.
 *
 * @param acordao - Documento de referência para comparação de datas.
 * @param acordaoDocs - Lista de documentos restritos do tipo acórdão.
 * @param movimentacoes - Lista de movimentações do processo, contendo data e descrição.
 * @returns Array de documentos posteriores ao acórdão e, se aplicável, anteriores à data limite, com tipo 'AcordaoED'.
 */
const getDocsAcordaoED = (
  acordao: DocumentosRestritos | null,
  acordaoDocs: DocumentosRestritos[],
  movimentacoes: { data: string; descricao: string }[],
): DocumentosRestritos[] => {
  if (!acordao) return [];

  const getTime = (d: string) =>
    new Date(d.split('/').reverse().join('-')).getTime();

  // 1. Encontra a movimentação "transitado em julgado"
  const transitado = movimentacoes.find((mov) =>
    /transitado em julgado/i.test(mov.descricao),
  );

  // 2. Verifica se na mesma data existe "Revogada a decisão anterior"
  let dataLimite: number | null = null;
  if (transitado) {
    const mesmaDataRevogada = movimentacoes.some(
      (mov) =>
        getTime(mov.data) === getTime(transitado.data) &&
        /revogada a decisão anterior/i.test(mov.descricao),
    );

    if (!mesmaDataRevogada) {
      dataLimite = getTime(transitado.data);
    }
  }
  // 3. Filtra todos os documentos após o Acórdão
  let docsFiltrados = acordaoDocs.filter(
    (doc) => getTime(doc.data) > getTime(acordao.data),
  );

  // 4. Se existir data limite, filtrar apenas os anteriores
  if (dataLimite) {
    docsFiltrados = docsFiltrados.filter(
      (doc) => getTime(doc.data) < dataLimite,
    );
  }

  // 5. Retorna com tipo ajustado
  return docsFiltrados.map((doc) => ({
    ...doc,
    tipo: ProcessDocumentType.AcordaoED,
  }));
};

/**
 * Retorna o primeiro acórdão válido a partir de uma lista de documentos restritos.
 *
 * A função busca todos os acórdãos e sentenças nos documentos fornecidos. Se houver uma sentença
 * com data posterior ao primeiro acórdão encontrado, considera o próximo acórdão como válido.
 * Caso contrário, retorna o primeiro acórdão. Se não houver acórdãos, retorna `null`.
 *
 * @param docs Lista de documentos restritos a serem analisados.
 * @returns O acórdão válido com o tipo ajustado ou `null` se não houver acórdão válido.
 */
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

  return acordaoValido
    ? { ...acordaoValido, tipo: ProcessDocumentType.Acordao }
    : null;
};

/**
 * Retorna o documento do tipo "Petição Inicial" a partir de uma lista de documentos restritos.
 *
 * Procura na lista `docs` por um documento cujo título, após normalização, contenha as palavras "peticao" e "inicial".
 * O documento encontrado é retornado com o tipo definido como `ProcessDocumentType.PeticaoInicial`.
 *
 * @param docs - Array de documentos restritos a serem pesquisados.
 * @returns O documento correspondente à petição inicial, com o tipo ajustado.
 */
const peticaoDoc = (docs: DocumentosRestritos[]) => {
  return {
    ...docs.find((doc) =>
      normalizeString(doc.titulo).match(/.*peticao.*inicial.*/i),
    ),
    tipo: ProcessDocumentType.PeticaoInicial,
  };
};

/**
 * Filtra, remove duplicatas e ordena documentos do tipo "acórdão" a partir de uma lista de documentos restritos.
 *
 * - Filtra documentos cujo título contém "acordao" (case insensitive).
 * - Remove documentos duplicados com base no campo `unique_name`.
 * - Ordena os documentos por data (do mais antigo ao mais recente), considerando o formato de data "dd/MM/yyyy".
 *
 * @param docs Lista de documentos restritos a serem processados.
 * @returns Uma lista de documentos do tipo "acórdão", únicos e ordenados por data.
 */
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
  return acordao;
};

/**
 * Filtra, remove duplicatas e ordena uma lista de documentos restritos que possuem "sentenca" no título.
 *
 * - Primeiro, seleciona apenas os documentos cujo título contém a palavra "sentenca" (case-insensitive).
 * - Em seguida, remove duplicatas com base no campo `unique_name`.
 * - Por fim, ordena os documentos pela data (formato DD/MM/YYYY), do mais antigo ao mais recente.
 *
 * @param docs Lista de documentos restritos a serem filtrados e ordenados.
 * @returns Uma nova lista de documentos filtrados, sem duplicatas e ordenados por data.
 */
const SentencaDoc = (docs: DocumentosRestritos[]) => {
  return docs
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
};
