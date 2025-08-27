// src/modules/pje/services/process-find.service.ts

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  DetalheProcesso,
  DocumentosRestritos,
  ItensProcesso,
  ProcessosResponse,
} from 'src/interfaces';
import { Root } from 'src/interfaces/normalize';
import { AwsS3Service } from 'src/services/aws-s3.service';
import redis from 'src/shared/redis';
import { normalizeDocsResponse } from 'src/utils/documents';
import { normalizeResponse } from 'src/utils/normalizeResponse';
import { userAgents } from 'src/utils/user-agents';
import { CaptchaService } from './captcha.service';
import { DocumentoService } from './documents.service';
import { PjeLoginService } from './login.service';

@Injectable()
export class ProcessDocumentsFindService {
  logger = new Logger(ProcessDocumentsFindService.name);

  constructor(
    private readonly loginService: PjeLoginService,
    private readonly captchaService: CaptchaService,
    private readonly documentoService: DocumentoService,
    private readonly awsS3Service: AwsS3Service,
  ) {}
  // 🔹 Contas disponíveis
  private contas = [
    {
      username: process.env.PJE_USER_FIRST as string,
      password: process.env.PJE_PASS_FIRST as string,
    },
    // {
    //   username: process.env.PJE_USER_SECOND as string,
    //   password: process.env.PJE_PASS_SECOND as string,
    // },
  ];

  // 🔹 Controle de alternância
  private contaIndex = 0;
  private contadorProcessos = 0;
  // Função auxiliar para delay
  private async delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private async randomDelay(min = 1000, max = 3000) {
    const time = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.delay(time);
  }

  /**
   * 🔹 Alterna conta a cada 5 processos processados
   * @param force força a troca de conta imediatamente
   */
  private getConta(force = false): { username: string; password: string } {
    if (force || this.contadorProcessos >= 5) {
      this.contaIndex = (this.contaIndex + 1) % this.contas.length;
      this.contadorProcessos = 0;
      this.logger.debug(
        `🔄 Alternando para a conta: ${this.contas[this.contaIndex].username}`,
      );
    }
    this.contadorProcessos++;
    return this.contas[this.contaIndex];
  }

  async execute(numeroDoProcesso: string, tentativas = 0): Promise<Root> {
    const regionTRT = Number(numeroDoProcesso.split('.')[3]);
    try {
      const tokenCaptcha = await redis.get('pje:token:captcha');
      // 🔹 Escolhe a conta atual
      const { username, password } = this.getConta();
      const cacheKey = `pje:auth:cookies:${username}`;
      let cookies = await redis.get(cacheKey);

      if (!cookies) {
        // 🔹 Faz login com a conta atual
        const login = await this.loginService.execute(
          regionTRT,
          username,
          password,
        );
        if (!login?.cookies) {
          this.logger.error(
            `Falha ao obter cookies de autenticação para ${username}`,
          );
          return normalizeResponse(
            numeroDoProcesso,
            [],
            'Não foi possível acessar o PJe.',
          );
        }
        cookies = login.cookies;
        await redis.set(cacheKey, cookies);
      } else {
        try {
          // Testa se o cookie ainda está válido fazendo uma requisição simples
          await axios.get(
            `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/dadosbasicos/${numeroDoProcesso}`,
            {
              headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
                'x-grau-instancia': '1',
                referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/1`,
                'user-agent':
                  userAgents[Math.floor(Math.random() * userAgents.length)],
                cookie: cookies,
              },
            },
          );
        } catch (err: any) {
          // Se não estiver válido, faz login novamente
          this.logger.debug(
            `Cookie expirado para ${username}, realizando novo login...`,
          );
          const login = await this.loginService.execute(
            regionTRT,
            username,
            password,
          );
          if (!login?.cookies) {
            this.logger.error(`Falha ao renovar cookies para ${username}`);
            return normalizeResponse(
              numeroDoProcesso,
              [],
              'Não foi possível acessar o PJe.',
            );
          }
          cookies = login.cookies;
          await redis.set(cacheKey, cookies);
        }
      }

      const instances: ProcessosResponse[] = [];

      for (let i = 1; i < 3; i++) {
        try {
          // Delay antes da requisição de dados básicos
          const delayMs =
            Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000;
          this.logger.debug(
            `⏱ Delay de ${delayMs}ms antes de dar inicio a ${i}ª instância`,
          );
          await this.delay(delayMs);

          const responseDadosBasicos = await axios.get<DetalheProcesso[]>(
            `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/dadosbasicos/${numeroDoProcesso}`,
            {
              headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
                'x-grau-instancia': i.toString(),
                referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${i}`,
                'user-agent':
                  userAgents[Math.floor(Math.random() * userAgents.length)],
                cookie: cookies,
              },
            },
          );

          const detalheProcesso = responseDadosBasicos.data[0];
          if (!detalheProcesso) continue;

          this.logger.debug(
            `⏱ Delay de ${delayMs}ms antes de processar a ${i}ª instância`,
          );
          await this.delay(delayMs);
          let processoResponse: ProcessosResponse = await this.fetchProcess(
            numeroDoProcesso,
            detalheProcesso.id,
            i.toString(),
            tokenCaptcha as string,
            undefined,
            undefined,
            cookies,
          );

          if (
            'imagem' in processoResponse &&
            'tokenDesafio' in processoResponse
          ) {
            this.logger.debug(
              `⏱ Delay de ${delayMs}ms antes de resolver o captcha da ${i}ª instância`,
            );
            await this.delay(delayMs);
            const resposta = await this.fetchCaptcha(
              processoResponse.imagem,
              processoResponse.tokenDesafio,
            );
            this.logger.debug(
              `⏱ Delay de ${delayMs}ms antes de processar a ${i}ª instância depois do resolvimento do captcha`,
            );
            await this.delay(delayMs);
            processoResponse = await this.fetchProcess(
              numeroDoProcesso,
              detalheProcesso.id,
              i.toString(),
              undefined,
              processoResponse.tokenDesafio,
              resposta,
              cookies,
            );
          }

          const itensProcesso =
            processoResponse.itensProcesso
              ?.map(
                (itens) =>
                  ({
                    ...itens,
                    instancia: i === 1 ? 'PRIMEIRO_GRAU' : 'SEGUNDO_GRAU',
                    documentoId: itens.id,
                    instanciaId: processoResponse.id,
                  }) as ItensProcesso,
              )
              ?.filter((item) => item !== null) || [];

          // Delay antes do upload dos documentos

          const normalizeDocsRestrict = normalizeDocsResponse(
            regionTRT,
            itensProcesso,
          );
          let documentosRestritos: DocumentosRestritos[] = [];
          this.logger.debug(
            `⏱ Delay de ${delayMs}ms antes de dar inicio a extração de documentos da ${i}ª instância`,
          );
          await this.delay(delayMs);
          if (normalizeDocsRestrict.length > 0) {
            documentosRestritos = await this.uploadDocumentosRestritos(
              normalizeDocsRestrict,
              regionTRT,
              cookies,
            );
          }
          instances.push({
            ...processoResponse,
            grau: i === 1 ? 'PRIMEIRO_GRAU' : 'SEGUNDO_GRAU',
            documentos_restritos: documentosRestritos,
          });
        } catch (err) {
          this.logger.warn(
            `Falha ao buscar instância ${i} para o processo ${numeroDoProcesso}: ${err.message}`,
          );
          continue;
        }
      }

      return normalizeResponse(numeroDoProcesso, instances, '', true);
    } catch (error) {
      this.logger.warn(
        `Erro geral para ${numeroDoProcesso}, alternando conta...`,
      );
      if (tentativas >= 3) {
        return normalizeResponse(
          numeroDoProcesso,
          [],
          'Falha após múltiplas tentativas',
        );
      }
      const { username, password } = this.getConta(true); // força troca
      const cacheKey = `pje:auth:cookies:${username}`;
      let cookies = await redis.get(cacheKey);
      const login = await this.loginService.execute(
        regionTRT,
        username,
        password,
      );
      cookies = login.cookies;
      await redis.set(cacheKey, cookies);

      return await this.execute(numeroDoProcesso, tentativas + 1);
    }
  }

  // Mesma ideia de delay dentro do fetchProcess e fetchCaptcha se necessário
  async fetchProcess(
    numeroDoProcesso: string,
    detalheProcessoId: string,
    instance: string,
    tockenCaptcha?: string,
    tokenDesafio?: string,
    resposta?: string,
    cookies?: string,
    tentativas = 0,
  ): Promise<ProcessosResponse> {
    const regionTRT = Number(numeroDoProcesso.split('.')[3]);
    try {
      let url = `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/${detalheProcessoId}`;
      if (tockenCaptcha) {
        url += `?tokenCaptcha=${tockenCaptcha}`;
      } else if (tokenDesafio && resposta) {
        url += `?tokenDesafio=${tokenDesafio}&resposta=${resposta}`;
      }

      const response = await axios.get<ProcessosResponse>(url, {
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'x-grau-instancia': instance,
          referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${instance}`,
          'user-agent':
            userAgents[Math.floor(Math.random() * userAgents.length)],
          cookie: cookies,
        },
      });

      const tokenCaptcha: string = response.headers['captchatoken'] as string;
      if (tokenCaptcha) {
        const captchaKey =
          instance === '1' ? 'pje:token:captcha:1' : 'pje:token:captcha:2';

        await redis.set(captchaKey, tokenCaptcha);
      }
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429 && tentativas < 5) {
        // 🔹 Retry exponencial: 1s, 2s, 4s, 8s, 16s
        const waitTime = Math.pow(2, tentativas) * 1000;
        console.warn(
          `429 recebido, esperando ${waitTime}ms antes de tentar novamente...`,
        );
        await new Promise((res) => setTimeout(res, waitTime));
        return await this.fetchProcess(
          numeroDoProcesso,
          detalheProcessoId,
          instance,
          tockenCaptcha,
          tokenDesafio,
          resposta,
          cookies,
          tentativas + 1,
        );
      }
      console.error('Erro fetching process:', error.message);
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

  async uploadDocumentosRestritos(
    documentos: DocumentosRestritos[],
    regionTRT: number,
    cookies: string,
  ): Promise<DocumentosRestritos[]> {
    const uploadedDocuments: DocumentosRestritos[] = [];
    const batchSize = 2; // processa 2 documentos simultaneamente
    const maxRetries = 2; // tentativas em caso de falha temporária

    // divide em batches
    for (let i = 0; i < documentos.length; i += batchSize) {
      const batch = documentos.slice(i, i + batchSize);

      // processa cada batch em paralelo
      await Promise.all(
        batch.map(async (documento) => {
          let attempt = 0;
          while (attempt <= maxRetries) {
            try {
              const delayMs =
                Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000;
              this.logger.debug(
                `⏱ Delay de ${delayMs}ms antes de processar documento ${documento.documentoId}`,
              );
              await this.delay(delayMs);

              this.logger.debug(
                `📄 Iniciando upload do documento ${documento.documentoId} da instância ${documento.instancia}`,
              );

              const buffer = await this.documentoService.execute(
                documento.instanciaId,
                documento.documentoId,
                regionTRT,
                documento.instancia,
                cookies,
              );

              const fileName = `${documento.documentoId}.pdf`;
              const url = await this.awsS3Service.uploadPdf(buffer, fileName);

              uploadedDocuments.push({ ...documento, link_api: url });
              break; // sucesso, sai do loop de retry
            } catch (error) {
              attempt++;
              this.logger.warn(
                `❌ Falha ao processar documento ${documento.documentoId}, tentativa ${attempt} de ${maxRetries}: ${error.message}`,
              );
              if (attempt > maxRetries) {
                this.logger.error(
                  `💥 Erro definitivo ao processar documento ${documento.documentoId}`,
                  error,
                );
              } else {
                // espera antes de tentar novamente (retry exponencial simples)
                const waitTime = attempt * 3000;
                await this.delay(waitTime);
              }
            }
          }
        }),
      );
    }

    return uploadedDocuments;
  }
}
