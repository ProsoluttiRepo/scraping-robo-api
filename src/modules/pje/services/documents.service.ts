import { Injectable } from '@nestjs/common';
import axios from 'axios';
import redis from 'src/shared/redis';
import puppeteer from 'puppeteer';

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
          'x-grau-instancia': instancia === 'PRIMEIRO_GRAU' ? '1' : '2',
          referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${processId}/${instancia === 'PRIMEIRO_GRAU' ? '1' : '2'}`,
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        },
        responseType: 'arraybuffer',
        withCredentials: true,
      });

      const contentType = response.headers['content-type'] as string;

      const isHtml =
        contentType.includes('text/html') ||
        contentType.includes('text/plain') ||
        contentType.includes('application/json');
      if (isHtml) {
        return Buffer.from(
          await this.htmlToPdfBuffer((response.data as string).toString()),
        );
      }
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

  async htmlToPdfBuffer(html: string) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    return pdfBuffer;
  }
}
