import { Injectable } from '@nestjs/common';
import axios from 'axios';
import redis from 'src/shared/redis';

@Injectable()
export class DocumentoService {
  async execute(documentoId: number): Promise<Buffer> {
    try {
      const cookies = await redis.get('pje:auth:cookies');
      const redisCaptchaKey = await redis.get(`pje:captcha`);
      const parseCaptcha = redisCaptchaKey
        ? (JSON.parse(redisCaptchaKey) as {
            tokenDesafio: string;
            resposta: string;
          })
        : null;
      const url = `https://pje.trt2.jus.br/pje-consulta-api/api/processos/5317087/documentos/323424744`;
      // const newCookie = `captchaToken=${parseCaptcha?.tokenDesafio}; acessoterceirostoken=${parseCaptcha?.tokenDesafio}; tokenDesafio=${parseCaptcha?.tokenDesafio}; resposta=${parseCaptcha?.resposta}; ${cookies}`;
      const newCookie = [
        `captchaToken=${encodeURIComponent(parseCaptcha?.tokenDesafio ?? '')}`,
        `acessoterceirostoken=${encodeURIComponent(parseCaptcha?.tokenDesafio ?? '')}`,
        `tokenDesafio=${encodeURIComponent(parseCaptcha?.tokenDesafio ?? '')}`,
        `resposta=${encodeURIComponent(parseCaptcha?.resposta ?? '')}`,
        cookies, // já deve ser uma string com os demais cookies no formato correto
      ].join('; ');
      const response = await axios.get(url, {
        headers: {
          Cookie: newCookie,
          // Accept: 'application/pdf',
          'x-grau-instancia': '1',
          referer:
            'https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/1000778-81.2023.5.02.0707/1',
          'content-encoding': 'gzip',
        },
        responseType: 'arraybuffer',
        withCredentials: true,
      });
      console.log({ response });

      return Buffer.from(response.data);
    } catch (error) {
      console.error(
        `Erro ao obter documento ${documentoId}:`,
        error?.response?.status,
        error?.response?.data || error,
      );
      throw error;
    }
  }
}
