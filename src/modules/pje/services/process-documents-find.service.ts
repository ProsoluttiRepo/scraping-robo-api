// src/modules/pje/services/process-find.service.ts

import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { DetalheProcesso, ProcessosResponse } from 'src/interfaces';
import redis from 'src/shared/redis';
import { CaptchaService } from './captcha.service';
import { PjeLoginService } from './login.service';

@Injectable()
export class ProcessDocumentsFindService {
  constructor(
    private readonly loginService: PjeLoginService,
    private readonly captchaService: CaptchaService,
  ) {}

  async execute(numeroDoProcesso: string, instance: string): Promise<any> {
    let cookies = await redis.get('pje:auth:cookies');

    // Se não existir ou estiver expirado
    if (!cookies) {
      const login = await this.loginService.execute();
      cookies = login.cookies;

      // Armazena no Redis por 30 minutos (1800 segundos)
      await redis.set('pje:auth:cookies', cookies);
      return await this.execute(numeroDoProcesso, instance);
    }

    try {
      const responseDadosBasicos = await axios.get<DetalheProcesso[]>(
        `https://pje.trt2.jus.br/pje-consulta-api/api/processos/dadosbasicos/${numeroDoProcesso}`,
        {
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'x-grau-instancia': instance,
            referer: `https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}`,
            'user-agent': 'Mozilla/5.0',
            cookie: cookies,
          },
        },
      );
      const redisCaptchaKey = `pje:captcha`;
      const cachedCaptcha = await redis.get(redisCaptchaKey);
      let parseCaptcha = cachedCaptcha
        ? (JSON.parse(cachedCaptcha) as {
            tokenDesafio: string;
            resposta: string;
          })
        : null;
      const detalheProcesso = responseDadosBasicos.data[0];

      let processoResponse: ProcessosResponse = {} as ProcessosResponse;
      processoResponse = await this.fetchProcess(
        numeroDoProcesso,
        detalheProcesso.id,
        instance,
        cookies,
        parseCaptcha?.tokenDesafio,
        parseCaptcha?.resposta,
      );

      if ('imagem' in processoResponse && 'tokenDesafio' in processoResponse) {
        const resposta = await this.fetchCaptcha(
          processoResponse.imagem,
          processoResponse.tokenDesafio,
        );
        const cachedCaptcha = await redis.get(redisCaptchaKey);
        parseCaptcha = cachedCaptcha
          ? (JSON.parse(cachedCaptcha) as {
              tokenDesafio: string;
              resposta: string;
            })
          : null;
        const response = await this.fetchProcess(
          numeroDoProcesso,
          detalheProcesso.id,
          instance,
          cookies,
          processoResponse.tokenDesafio,
          resposta,
          'tokenDesafio',
        );
        processoResponse = response;
      }
      const documentos = processoResponse?.itensProcesso?.filter(
        (item) => item.documento,
      );

      return {
        processo: processoResponse,
        tokenCaptcha: parseCaptcha?.tokenDesafio,
        documentos,
      };
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Login expirado, refaz login
        const login = await this.loginService.execute();
        cookies = login.cookies;

        await redis.set('pje:auth:cookies', cookies);

        return await this.execute(numeroDoProcesso, instance);
      }

      throw error;
    }
  }
  async fetchProcess(
    numeroDoProcesso: string,
    detalheProcessoId: string,
    instance: string,
    cookies: string,
    tokenDesafio?: string,
    resposta?: string,
    type?: 'tokenCaptcha' | 'tokenDesafio',
  ): Promise<ProcessosResponse> {
    try {
      let url = `https://pje.trt2.jus.br/pje-consulta-api/api/processos/${detalheProcessoId}`;
      if (type === 'tokenDesafio') {
        if (tokenDesafio && resposta) {
          url += `?tokenDesafio=${tokenDesafio}&resposta=${resposta}`;
        }
      } else {
        url += `?tokenCaptcha=${tokenDesafio}`;
      }
      const newCookie = `captchaToken=${tokenDesafio}; acessoterceirostoken=${tokenDesafio}; tokenDesafio=${tokenDesafio}; resposta=${resposta}; ${cookies}`;

      const response = await axios.get<ProcessosResponse>(url, {
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'x-grau-instancia': instance,
          'user-agent': 'Mozilla/5.0',
          acessoterceirostoken: tokenDesafio,
          referer: `https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${instance}`,
          priority: 'u=1, i',
          cookie: newCookie,
        },
      });
      console.log('🔍 Response Headers:', response.headers);
      return response.data;
    } catch (error) {
      console.error('Error fetching process:', error);
      throw error;
    }
  }

  async fetchCaptcha(imagem: string, tokenDesafio: string): Promise<string> {
    try {
      const redisCaptchaKey = `pje:captcha`;

      const captcha = await this.captchaService.resolveCaptcha(imagem);
      const captchaDetalheProcesso = {
        resposta: captcha.resposta,
        tokenDesafio: tokenDesafio,
      };
      // Salva no Redis por 5 minutos
      await redis.set(redisCaptchaKey, JSON.stringify(captchaDetalheProcesso));
      return captcha.resposta;
    } catch (error) {
      console.error('Erro ao buscar captcha:', error.message);
      return '';
    }
  }
}
