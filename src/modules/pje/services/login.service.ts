// src/modules/pje/pje-login.service.ts

import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PjeLoginService {
  async execute() {
    const browser = await puppeteer.launch({
      headless: false, // true se quiser rodar em segundo plano
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Vá para a tela de login
    await page.goto('https://pje.trt2.jus.br/primeirograu/login.seam', {
      waitUntil: 'networkidle2',
    });

    // Clica no botão "Acesso com certificado"
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.evaluate(() => {
        (document.querySelector('#btnSsoPdpj') as HTMLElement)?.click();
      }),
    ]);

    // Preenche o login
    const username = process.env.PJE_USER ?? '44164436840';
    const password = process.env.PJE_PASS ?? 'Ascendesuperius3#';

    await page.waitForSelector('#username');
    await page.type('#username', username);
    await page.type('#password', password);

    // Faz login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('input[type="submit"]'),
    ]);

    // Pega cookies logo após o login
    const cookies = await page.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Você pode fechar o navegador agora, ou continuar o fluxo...
    await browser.close();

    return {
      cookies: cookieString,
    };
  }
}
