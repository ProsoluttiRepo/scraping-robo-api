export interface DetalheProcesso {
  id: string;

  [key: string]: any;
}
export interface ItensProcesso {
  documento: boolean;
  id: string;
}
export interface ProcessosResponse {
  mensagem: string;
  tokenDesafio: string;
  itensProcesso: ItensProcesso[];
  imagem: string; // base64 da imagem
  resposta: string; // resposta do captcha
  [key: string]: any;
}
