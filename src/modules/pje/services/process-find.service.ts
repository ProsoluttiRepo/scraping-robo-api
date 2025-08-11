import { Injectable } from '@nestjs/common';

import axios from 'axios';
import { CaptchaResult, CaptchaService } from './captcha.service';
import redis from 'src/shared/redis';
import { DetalheProcesso } from 'src/interfaces';

@Injectable()
export class ProcessFindService {
  constructor(private readonly captchaService: CaptchaService) {}
  async execute(numeroDoProcesso: string, instance: string): Promise<any> {
    let captchaData = await redis.get('pje:captcha:data');
    const parsedCaptchaData: { tokenDesafio?: string; resposta?: string } =
      captchaData
        ? (JSON.parse(captchaData) as {
            tokenDesafio?: string;
            resposta?: string;
          })
        : {};
    const tokenDesafio = parsedCaptchaData.tokenDesafio;
    const resposta = parsedCaptchaData.resposta;

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
          },
        },
      );
      const url = `https://pje.trt2.jus.br/pje-consulta-api/api/captcha?idProcesso=${responseDadosBasicos.data[0].id}`;
      const captchaResponse = await axios.get(url, {
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
      });
      const detalheProcesso = responseDadosBasicos.data[0];
      if (!tokenDesafio || !resposta) {
        console.log(
          `Resolvendo captcha para o processo: ${detalheProcesso.id}`,
        );
        const captcha: CaptchaResult = await this.captchaService.resolveCaptcha(
          detalheProcesso.id,
        );
        captchaData = JSON.stringify({
          resposta: captcha.resposta,
        });
        await redis.set('pje:captcha:data', captchaData);
        return await this.execute(numeroDoProcesso, instance);
      }
      const processos = await axios.get(
        `https://pje.trt2.jus.br/pje-consulta-api/api/processos/${detalheProcesso.id}?tokenDesafio=${tokenDesafio}&resposta=${resposta}`,
        {
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'x-grau-instancia': instance,
            'user-agent': 'Mozilla/5.0',
          },
        },
      );
      if (
        processos.data.mensagem === 'O desafio expirou' ||
        processos.data.mensagem === 'O token é inválido para esta consulta'
      ) {
        const captcha = await this.captchaService.resolveCaptcha(
          detalheProcesso.id,
        );
        await redis.set(
          'pje:captcha:data',
          JSON.stringify({
            resposta: captcha.resposta,
            tokenDesafio: captchaResponse.data.tokenDesafio,
          }),
        );
        return await this.execute(numeroDoProcesso, instance);
      }

      return processos.data;
    } catch (error) {
      console.error('Erro ao encontrar processo:', error);
      return null;
    }
  }
}
