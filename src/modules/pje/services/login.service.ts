// src/modules/pje/pje-login.service.ts
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';

// 🔹 Import puppeteer-extra e stealth
import puppeteer from 'puppeteer-extra';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import StealthPlugin = require('puppeteer-extra-plugin-stealth');
import { userAgents } from 'src/utils/user-agents';
// Import correto para puppeteer-extra
import type { Browser } from 'puppeteer';

// Adiciona o plugin stealth
puppeteer.use(StealthPlugin());

@Injectable()
export class PjeLoginService {
  private readonly logger = new Logger(PjeLoginService.name);
  private readonly redis = new Redis(process.env.REDIS_HOST as string);

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async execute(
    regionTRT: number,
    username: string,
    password: string,
    expired: boolean = false,
  ): Promise<{ cookies: string }> {
    const cacheKey = `pje:session:${regionTRT}:${username}`;

    // 1️⃣ Verifica se já existe sessão em cache
    const cachedCookies = await this.redis.get(cacheKey);
    if (cachedCookies && !expired) {
      this.logger.debug(`Sessão reutilizada para TRT-${regionTRT}`);
      return { cookies: cachedCookies };
    }

    const loginUrl = `https://pje.trt${regionTRT}.jus.br/primeirograu/login.seam`;

    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      let browser: Browser | null = null;
      attempt++;

      try {
        this.logger.debug(
          `Tentativa ${attempt} de login no PJe TRT-${regionTRT}...`,
        );

        browser = await puppeteer.launch({
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
        page.setDefaultNavigationTimeout(30000);

        // 🔹 User-Agent e viewport aleatórios
        const randomUA =
          userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        await page.setViewport({
          width: 1200 + Math.floor(Math.random() * 300),
          height: 800 + Math.floor(Math.random() * 300),
        });

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
        await page.type('#username', username, {
          delay: 100 + Math.random() * 100,
        });
        await page.type('#password', password, {
          delay: 100 + Math.random() * 100,
        });

        await this.delay(1000 + Math.random() * 1000);
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
          page.click('input[type="submit"]'),
        ]);

        // 🔹 Validação do login (checa se o painel carregou)
        try {
          await page.waitForSelector('button[name="Meu Painel"]', {
            visible: true,
            timeout: 5000,
          });
          await page.click('button[name="Meu Painel"]');
        } catch {
          throw new ServiceUnavailableException(
            `Falha no login: painel não encontrado no TRT-${regionTRT}`,
          );
        }

        // 🔹 Se chegou até aqui, login foi bem-sucedido
        const cookies = await page.cookies();
        const cookieString = cookies
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');

        await this.redis.set(cacheKey, cookieString, 'EX', 60 * 30);

        this.logger.debug(
          `Sessão criada e armazenada no Redis para TRT-${regionTRT}`,
        );
        return { cookies: cookieString };
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error(
            `Erro ao tentar logar no PJe TRT-${regionTRT}`,
            error.message,
          );
          if (!error.message.includes('Timeout')) {
            throw new ServiceUnavailableException(
              'Não foi possível acessar o PJe.',
            );
          }
        } else {
          this.logger.error(
            `Erro desconhecido ao tentar logar no PJe TRT-${regionTRT}`,
            String(error),
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
