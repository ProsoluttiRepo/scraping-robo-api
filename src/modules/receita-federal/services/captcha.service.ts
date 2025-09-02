import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import puppeteer from 'puppeteer';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly apiKey = process.env.API_KEY_2CAPTCHA;

  async solveCaptcha(url: string): Promise<string> {
    this.logger.log(`Abrindo página: ${url}`);

    const browser = await puppeteer.launch({
      headless: false, // necessário para interagir com captcha
      args: ['--disable-web-security'],
    });

    const page = await browser.newPage();
    await page.goto(url);

    this.logger.log('A página abriu, resolva o captcha manualmente...');

    // Espera até que o usuário resolva o captcha
    await page.waitForFunction(
      () => {
        const tokenEl = document.querySelector(
          'textarea[name="h-captcha-response"]',
        );
        return tokenEl && (tokenEl as HTMLTextAreaElement).value.length > 0;
      },
      { timeout: 0 },
    ); // sem timeout

    // Captura o token do hCaptcha
    const token = await page.evaluate(() => {
      const tokenEl = document.querySelector(
        'textarea[name="h-captcha-response"]',
      ) as HTMLTextAreaElement;
      return tokenEl.value;
    });

    await browser.close();

    this.logger.log('Captcha resolvido!');
    return token;
  }
  async solve2Captcha(
    siteKey: string,
    pageUrl: string,
    type: 'recaptcha' | 'hcaptcha' = 'recaptcha', // default reCAPTCHA
  ): Promise<string> {
    try {
      this.logger.debug(
        `Resolvendo captcha [${type}] para siteKey: ${siteKey} na URL: ${pageUrl}`,
      );

      // define o método de acordo com o tipo
      const method = type === 'hcaptcha' ? 'hcaptcha' : 'userrecaptcha';
      const keyParam = type === 'hcaptcha' ? 'sitekey' : 'googlekey';

      // 1️⃣ Envia captcha para 2Captcha
      const sendResponse = await axios.get(
        `http://2captcha.com/in.php?key=${this.apiKey}&method=${method}&${keyParam}=${siteKey}&pageurl=${pageUrl}&json=1`,
      );

      if (!sendResponse.data || sendResponse.data.status !== 1) {
        this.logger.error(
          `Erro ao enviar captcha: ${JSON.stringify(sendResponse.data)}`,
        );
        throw new Error('Erro ao enviar captcha para 2Captcha');
      }

      const captchaId = sendResponse.data.request;

      // 2️⃣ Espera a resolução
      let result: string | null = null;
      while (!result) {
        await new Promise((r) => setTimeout(r, 5000)); // espera 5s
        const res = await axios.get(
          `http://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${captchaId}&json=1`,
        );

        if (res.data.status === 1) {
          result = res.data.request;
        } else if (res.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`Erro no 2Captcha: ${res.data.request}`);
        }
      }

      this.logger.debug(`Captcha resolvido com sucesso`);
      return result; // token que você insere no form
    } catch (error) {
      this.logger.error('Erro ao resolver captcha via 2Captcha', error);
      throw error;
    }
  }
}
