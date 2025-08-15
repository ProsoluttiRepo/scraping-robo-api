// src/modules/pje/pje-login.service.ts
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PjeLoginService {
  private readonly logger = new Logger(PjeLoginService.name);

  async execute(regionTRT: number): Promise<{ cookies: string }> {
    let browser: puppeteer.Browser | null = null;
    const loginUrl = `https://pje.trt${regionTRT}.jus.br/primeirograu/login.seam`;
    try {
      // 🖥️ Abrir Puppeteer
      browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(20000);

      await page.goto(loginUrl, { waitUntil: 'networkidle2' });

      // Clicar no botão "Acesso com certificado"
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.evaluate(() => {
          (document.querySelector('#btnSsoPdpj') as HTMLElement)?.click();
        }),
      ]);

      const username = process.env.PJE_USER as string;
      const password = process.env.PJE_PASS as string;

      await page.waitForSelector('#username', { visible: true });
      await page.type('#username', username);
      await page.type('#password', password);
      await page.waitForSelector('input[type="submit"]', { visible: true });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('input[type="submit"]'),
      ]);

      const cookies = await page.cookies();
      return { cookies: cookies.map((c) => `${c.name}=${c.value}`).join('; ') };
    } catch (error) {
      this.logger.error('Erro ao tentar logar no PJe', error);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Não foi possível acessar o PJe.');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
