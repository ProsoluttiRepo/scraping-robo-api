import { Injectable } from '@nestjs/common';
import axios from 'axios';
import redis from 'src/shared/redis';
import puppeteer from 'puppeteer';
import { userAgents } from 'src/utils/user-agents';

@Injectable()
export class DocumentoService {
  async execute(
    processId: number,
    documentoId: number,
    regionTRT: number,
    instancia: string,
    cookies: string,
  ): Promise<Buffer> {
    if (!processId || !documentoId || !regionTRT || !instancia) {
      throw new Error('Parâmetros inválidos fornecidos');
    }
    let tokenCaptcha;
    if (instancia === 'PRIMEIRO_GRAU') {
      tokenCaptcha = await redis.get('pje:token:captcha:1');
    } else {
      tokenCaptcha = await redis.get('pje:token:captcha:2');
    }
    console.log('Process ID:', processId);
    console.log('Documento ID:', documentoId);
    console.log('Region TRT:', regionTRT);
    console.log('Instancia:', instancia);

    try {
      const url = `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/${processId}/documentos/${documentoId}?tokenCaptcha=${tokenCaptcha}`;
      const response = await axios.get(url, {
        headers: {
          Cookie: cookies,
          'x-grau-instancia': instancia === 'PRIMEIRO_GRAU' ? '1' : '2',
          referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${processId}/${instancia === 'PRIMEIRO_GRAU' ? '1' : '2'}`,
          'user-agent':
            userAgents[Math.floor(Math.random() * userAgents.length)],
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
      console.error('Erro ao buscar documento:', error);
      throw new Error('Erro ao buscar documento');
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
