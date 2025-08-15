import { Injectable } from '@nestjs/common';
import axios from 'axios';
import redis from 'src/shared/redis';

@Injectable()
export class DocumentoService {
  async execute(
    processId: number,
    documentoId: number,
    regionTRT: number,
    instancia: string,
  ): Promise<Buffer> {
    let tokenCaptcha;
    if (instancia === 'PRIMEIRO_GRAU') {
      tokenCaptcha = await redis.get('pje:token:captcha:1');
    } else {
      tokenCaptcha = await redis.get('pje:token:captcha:2');
    }

    try {
      const cookies = await redis.get('pje:auth:cookies');

      const url = `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/${processId}/documentos/${documentoId}?tokenCaptcha=${tokenCaptcha}`;
      const response = await axios.get(url, {
        headers: {
          Cookie: cookies,
          'content-encoding': 'gzip',
          'x-grau-instancia': '1',
        },
        responseType: 'arraybuffer',
        withCredentials: true,
      });

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
