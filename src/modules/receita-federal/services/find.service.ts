import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { ReCaptchaService } from './recaptcha.service';

@Injectable()
export class CnpjScraperService {
  private readonly logger = new Logger(CnpjScraperService.name);

  constructor(private readonly reCaptchaService: ReCaptchaService) {}

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async execute(cnpj: string) {
    // Abrir Puppeteer limpo
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

    const page = await browser.newPage();

    // Navegar até a página inicial
    await page.goto(
      'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp',
      { waitUntil: 'networkidle2', timeout: 60000 },
    );

    // Digitar CNPJ devagar
    for (const char of cnpj) {
      await page.type('#cnpj', char);
      await this.delay(150);
    }

    // Capturar sitekey do hCaptcha
    const siteKey = await page.$eval('.h-captcha', (el) =>
      el.getAttribute('data-sitekey'),
    );
    if (!siteKey) {
      await browser.close();
      throw new Error('Sitekey do hCaptcha não encontrada.');
    }

    // Resolver captcha via serviço externo
    const captchaToken = await this.reCaptchaService.solve2Captcha(
      siteKey,
      page.url(),
      'hcaptcha',
    );
    this.logger.log('Captcha token obtido');

    // Pegar cookies atuais do Puppeteer
    const cookies = await page.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join(';');

    // Submeter POST do hCaptcha
    await page.evaluate(
      async (token, cnpj, cookieStr) => {
        const formData = new URLSearchParams();
        formData.append('origem', 'comprovante');
        formData.append('cnpj', cnpj);
        formData.append('h-captcha-response', token);

        await fetch(
          'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/valida_recaptcha.asp',
          {
            method: 'POST',
            body: formData,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Cookie: cookieStr,
            },
            credentials: 'include',
          },
        );
      },
      captchaToken,
      cnpj,
      cookieString,
    );

    await this.delay(5000);

    // Navegar para a página do comprovante
    await page.goto(
      'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/Cnpjreva_Comprovante.asp',
      { waitUntil: 'networkidle2', timeout: 60000 },
    );

    // Pegar o elemento #principal
    const element = await page.waitForSelector('#principal', {
      visible: true,
      timeout: 10000,
    });

    if (!element) {
      await browser.close();
      this.logger.error('Div #principal não encontrada na página.');
      return null;
    }

    // Capturar posição e tamanho da div
    const rect = await page.evaluate((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height, scrollY: window.scrollY };
    }, element);

    // Tirar screenshot apenas da div usando clip
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      clip: {
        x: rect.x,
        y: rect.y + rect.scrollY,
        width: rect.width,
        height: rect.height,
      },
    });

    await browser.close();

    // Criar PDF usando pdf-lib
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(screenshotBuffer);
    const pdfPage = pdfDoc.addPage([pngImage.width, pngImage.height]);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pngImage.width,
      height: pngImage.height,
    });

    const pdfBuffer = await pdfDoc.save();
    return pdfBuffer;
  }
}
