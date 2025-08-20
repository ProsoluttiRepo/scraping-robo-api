// src/modules/pje/process-find.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DetalheProcesso, ProcessosResponse } from 'src/interfaces';
import { normalizeResponse } from 'src/utils/normalizeResponse';
import { CaptchaService } from './captcha.service';

import { Root } from 'src/interfaces/normalize';

@Injectable()
export class ProcessFindService {
  private readonly logger = new Logger(ProcessFindService.name);

  constructor(private readonly captchaService: CaptchaService) {}

  async execute(numeroDoProcesso: string): Promise<Root> {
    const regionTRT = Number(numeroDoProcesso.split('.')[3]);

    try {
      const instances: ProcessosResponse[] = [];

      // Percorre 1ª e 2ª instância
      for (let i = 1; i < 3; i++) {
        try {
          const responseDadosBasicos = await axios.get<DetalheProcesso[]>(
            `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/dadosbasicos/${numeroDoProcesso}`,
            {
              headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
                'x-grau-instancia': i.toString(),
                referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${i}`,
                'user-agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
              },
            },
          );

          const detalheProcesso = responseDadosBasicos.data[0];
          if (!detalheProcesso) continue;

          let processoResponse: ProcessosResponse = await this.fetchProcess(
            numeroDoProcesso,
            detalheProcesso.id,
            i.toString(),
          );

          // Caso retorne captcha
          if (
            'imagem' in processoResponse &&
            'tokenDesafio' in processoResponse
          ) {
            const resposta = await this.fetchCaptcha(processoResponse.imagem);

            processoResponse = await this.fetchProcess(
              numeroDoProcesso,
              detalheProcesso.id,
              i.toString(),
              processoResponse.tokenDesafio,
              resposta,
            );
          }

          instances.push(processoResponse);
        } catch (err) {
          this.logger.warn(
            `Falha ao buscar instância ${i} para o processo ${numeroDoProcesso}: ${err.message}`,
          );
          continue;
        }
      }

      return normalizeResponse(numeroDoProcesso, instances);
    } catch (error) {
      this.logger.error(`Erro ao buscar processo ${numeroDoProcesso}`, error);

      // ⚠️ Se foi 401/403 → sessão expirada → refaz login
      if ([401, 403].includes(error?.response?.status)) {
        this.logger.warn(
          `Sessão expirada no TRT-${regionTRT}, refazendo login...`,
        );
        return this.execute(numeroDoProcesso); // reprocessa com novo login
      }

      throw error;
    }
  }

  async fetchProcess(
    numeroDoProcesso: string,
    detalheProcessoId: string,
    instance: string,
    // cookies: string,
    tokenDesafio?: string,
    resposta?: string,
  ) {
    const regionTRT = Number(numeroDoProcesso.split('.')[3]);

    try {
      let url = `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/${detalheProcessoId}`;
      if (tokenDesafio && resposta) {
        url += `?tokenDesafio=${tokenDesafio}&resposta=${resposta}`;
      }

      const response = await axios.get<ProcessosResponse>(url, {
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'x-grau-instancia': instance,
          referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${instance}`,
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar detalhes do processo ${numeroDoProcesso}`,
        error,
      );
      throw error;
    }
  }

  async fetchCaptcha(imagem: string): Promise<string> {
    try {
      const captcha = await this.captchaService.resolveCaptcha(imagem);
      return captcha.resposta;
    } catch (error) {
      this.logger.error('Erro ao resolver captcha:', error.message);
      return '';
    }
  }
}
