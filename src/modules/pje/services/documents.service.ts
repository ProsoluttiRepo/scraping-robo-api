import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import redis from 'src/shared/redis';
import puppeteer from 'puppeteer';
import { userAgents } from 'src/utils/user-agents';

@Injectable()
export class DocumentoService {
  private readonly logger = new Logger(DocumentoService.name);

  async execute(
    processId: number,
    documentoId: number,
    regionTRT: number,
    instancia: string,
    cookies: string,
  ): Promise<Buffer> {
    if (!processId || !documentoId || !regionTRT || !instancia) {
      this.logger.error('Parâmetros inválidos fornecidos');
      return Buffer.alloc(0);
    }
    let tokenCaptcha;
    if (instancia === 'PRIMEIRO_GRAU') {
      tokenCaptcha = await redis.get('pje:token:captcha:1');
    } else {
      tokenCaptcha = await redis.get('pje:token:captcha:2');
    }

    const url = `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/${processId}/documentos/${documentoId}?tokenCaptcha=${tokenCaptcha}`;
    const response = await axios.get(url, {
      headers: {
        Cookie: cookies,
        'x-grau-instancia': instancia === 'PRIMEIRO_GRAU' ? '1' : '2',
        referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${processId}/${instancia === 'PRIMEIRO_GRAU' ? '1' : '2'}`,
        'user-agent': userAgents[Math.floor(Math.random() * userAgents.length)],
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
  }

  async htmlToPdfBuffer(html: string) {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--single-process',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4' });
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
}
