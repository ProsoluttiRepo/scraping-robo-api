// src/modules/pje/pje-login.service.ts
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import Redis from 'ioredis';

@Injectable()
export class PjeLoginService {
  private readonly logger = new Logger(PjeLoginService.name);
  private readonly redis = new Redis(process.env.REDIS_HOST as string);

  async execute(regionTRT: number): Promise<{ cookies: string }> {
    const cacheKey = `pje:session:${regionTRT}`;

    // 1️⃣ Verifica se já existe sessão em cache
    const cachedCookies = await this.redis.get(cacheKey);
    console.log(cachedCookies);

    if (cachedCookies) {
      this.logger.debug(`Sessão reutilizada para TRT-${regionTRT}`);
      return { cookies: cachedCookies };
    }

    // 2️⃣ Faz login com Puppeteer
    const loginUrl = `https://pje.trt${regionTRT}.jus.br/primeirograu/login.seam`;
    const username = process.env.PJE_USER as string;
    const password = process.env.PJE_PASS as string;

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      let browser: puppeteer.Browser | null = null;
      attempt++;

      try {
        this.logger.debug(
          `Tentativa ${attempt} de login no PJe TRT-${regionTRT}...`,
        );

        browser = await puppeteer.launch({
          headless: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(30000);
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        // Botão "Acesso com certificado"
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
          page.evaluate(() => {
            (document.querySelector('#btnSsoPdpj') as HTMLElement)?.click();
          }),
        ]);

        // Login
        await page.waitForSelector('#username', { visible: true });
        await page.type('#username', username);
        await page.type('#password', password);

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
          page.click('input[type="submit"]'),
        ]);

        const cookies = await page.cookies();
        const cookieString = cookies
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');

        // 3️⃣ Salva no Redis com TTL (30 min)
        await this.redis.set(cacheKey, cookieString, 'EX', 60 * 30);

        this.logger.debug(
          `Sessão criada e armazenada no Redis para TRT-${regionTRT}`,
        );
        return { cookies: cookieString };
      } catch (error: any) {
        this.logger.error(
          `Erro ao tentar logar no PJe TRT-${regionTRT}`,
          error,
        );

        if (!error.message?.includes('Timeout')) {
          throw new ServiceUnavailableException(
            'Não foi possível acessar o PJe.',
          );
        }

        if (attempt >= maxAttempts) {
          throw new ServiceUnavailableException(
            `Não foi possível acessar o PJe TRT-${regionTRT} após várias tentativas.`,
          );
        }
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }

    throw new ServiceUnavailableException(
      `Erro inesperado no login do PJe TRT-${regionTRT}.`,
    );
  }
}
