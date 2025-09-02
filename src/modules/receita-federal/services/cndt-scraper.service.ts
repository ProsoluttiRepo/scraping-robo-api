import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CaptchaService } from 'src/services/captcha.service';

@Injectable()
export class CndtScraperService {
  private readonly logger = new Logger(CndtScraperService.name);

  constructor(private readonly captchaService: CaptchaService) {}

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async execute(cnpj: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true, // true em produção
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

    await page.goto('https://cndt-certidao.tst.jus.br/gerarCertidao.faces', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Preenche CNPJ
    await page.waitForSelector('input[name="gerarCertidaoForm:cpfCnpj"]', {
      visible: true,
    });
    await page.type('input[name="gerarCertidaoForm:cpfCnpj"]', cnpj, {
      delay: 120,
    });

    // Captura captcha Base64
    await page.waitForSelector('#idImgBase64', { visible: true });
    const captchaBase64 = await page.$eval(
      '#idImgBase64',
      (img: HTMLImageElement) =>
        img.src.replace(/^data:image\/\w+;base64,/, ''),
    );

    // Resolve captcha via 2Captcha
    const { resposta } =
      await this.captchaService.resolveCaptcha(captchaBase64);
    this.logger.log(`Captcha resolvido: ${resposta}`);

    // Preenche captcha
    await page.type('#idCampoResposta', resposta, { delay: 100 });

    // --- Configura download para /tmp ---
    const downloadPath = path.join(os.tmpdir(), 'cndt-downloads');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
    });

    // Limpa PDFs antigos
    fs.readdirSync(downloadPath)
      .filter((f) => f.endsWith('.pdf'))
      .forEach((f) => fs.unlinkSync(path.join(downloadPath, f)));

    // Clica no botão para emitir certidão
    await page.click('#gerarCertidaoForm\\:btnEmitirCertidao');

    // Espera até que o PDF apareça na pasta
    const fileName: string = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timeout aguardando PDF')),
        60000,
      );
      const interval = setInterval(() => {
        const files = fs
          .readdirSync(downloadPath)
          .filter((f) => f.endsWith('.pdf'));
        if (files.length > 0) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve(path.join(downloadPath, files[0]));
        }
      }, 500);
    });

    // Lê PDF como Buffer
    const buffer = fs.readFileSync(fileName);

    // Remove arquivo temporário
    fs.unlinkSync(fileName);

    await browser.close();
    return buffer;
  }
}
