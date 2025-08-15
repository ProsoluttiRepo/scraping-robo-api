export interface DetalheProcesso {
  id: string;

  [key: string]: any;
}
export interface ItensProcesso {
  documento: boolean;
  id: number;
  data: string; // ou Date, se você converter
  titulo: string;
  tipo: string;
  publico: boolean;
  idUnicoDocumento: number;
  instancia: string; // grau de instância
  instanciaId: number; // id da instância
}

type Assunto = {
  principal: boolean;
  descricao: string;
};

export type DocumentosRestritos = {
  documentoId: number;
  posicao_id?: number;
  titulo?: string;
  descricao?: string;
  data: string;
  unique_name?: string;
  link_api?: string;
  instancia: string;
  instanciaId: number;
  tipo?: string;
};

export interface ProcessosResponse {
  mensagem: string;
  tokenDesafio: string;
  itensProcesso: ItensProcesso[];
  grau?: string;
  imagem: string; // base64 da imagem
  resposta: string; // resposta do captcha
  [key: string]: any;
  id: number;
  numero: string;
  classe: string;
  orgaoJulgador: string;
  segredoJustica: boolean;
  justicaGratuita: boolean;
  distribuidoEm: string; // ou Date, se você converter
  autuadoEm: string; // ou Date
  valorDaCausa: number;
  poloAtivo: Polo[]; // pode substituir `any` pelo tipo correto
  poloPassivo: Polo[];
  assuntos: Assunto[];
  expedientes: any[];
  juizoDigital: boolean;
  documentos_restritos: DocumentosRestritos[];
}
type Documento = {
  tipo?: string;
  numero?: string;
};

type OAB = {
  numero?: string;
  uf?: string;
};

export type Partes = {
  id: number;
  tipo: string;
  nome: string;
  principal?: boolean;
  polo: string;
  documento: Documento;
  tipoDocumento?: string;
  advogado_de?: number;
  oabs?: OAB[];
};
export type Papeis = {
  identificador: string;
  nome: string;
};
export type Endereco = {
  estado: string;
};
export type Polo = {
  id: number;
  tipo: string;
  nome: string;
  principal?: boolean;
  polo: string;
  documento: string;
  tipoDocumento?: string;
  advogado_de?: number;
  representantes?: Polo[];
  papeis?: Papeis[];
  endereco?: Endereco;
  oabs?: OAB[];
};
