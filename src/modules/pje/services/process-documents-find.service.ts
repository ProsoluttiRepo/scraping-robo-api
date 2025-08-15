// src/modules/pje/services/process-find.service.ts

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  DetalheProcesso,
  DocumentosRestritos,
  ItensProcesso,
  ProcessosResponse,
} from 'src/interfaces';
import redis from 'src/shared/redis';
import { normalizeDocsResponse } from 'src/utils/documents';
import { normalizeResponse } from 'src/utils/normalizeResponse';
import { CaptchaService } from './captcha.service';
import { PjeLoginService } from './login.service';
import { DocumentoService } from './documents.service';
import { AwsS3Service } from 'src/services/aws-s3.service';

@Injectable()
export class ProcessDocumentsFindService {
  logger = new Logger(ProcessDocumentsFindService.name);

  constructor(
    private readonly loginService: PjeLoginService,
    private readonly captchaService: CaptchaService,
    private readonly documentoService: DocumentoService,
    private readonly awsS3Service: AwsS3Service,
  ) {}

  async execute(numeroDoProcesso: string): Promise<any> {
    let cookies = await redis.get('pje:auth:cookies');
    const regionTRT = Number(numeroDoProcesso.split('.')[3]);
    try {
      const tokenCaptcha = await redis.get('pje:token:captcha');
      if (!cookies) {
        const login = await this.loginService.execute(regionTRT);
        if (!login?.cookies) {
          this.logger.error('Falha ao obter cookies de autenticação');
          return normalizeResponse(
            numeroDoProcesso,
            [],
            'Não foi possível acessar o PJe.',
          );
        }
        cookies = login.cookies;

        // Armazena no Redis por 30 minutos (1800 segundos)
        await redis.set('pje:auth:cookies', cookies);
        return await this.execute(numeroDoProcesso);
      }
      const instances: ProcessosResponse[] = [];
      await axios.get<DetalheProcesso[]>(
        `https://pje.trt${regionTRT}.jus.br/pje-consulta-api/api/processos/dadosbasicos/${numeroDoProcesso}`,
        {
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'x-grau-instancia': 1,
            referer: `https://pje.trt${regionTRT}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/1`,
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            cookie: cookies,
          },
        },
      );
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
                cookie: cookies,
              },
            },
          );
          const detalheProcesso = responseDadosBasicos.data[0];
          if (!detalheProcesso) continue;
          let processoResponse: ProcessosResponse = await this.fetchProcess(
            numeroDoProcesso,
            detalheProcesso.id,
            i.toString(),
            tokenCaptcha as string,
          );

          // Se precisar resolver captcha
          if (
            'imagem' in processoResponse &&
            'tokenDesafio' in processoResponse
          ) {
            const resposta = await this.fetchCaptcha(
              processoResponse.imagem,
              processoResponse.tokenDesafio,
            );
            processoResponse = await this.fetchProcess(
              numeroDoProcesso,
              detalheProcesso.id,
              i.toString(),
              undefined,
              processoResponse.tokenDesafio,
              resposta,
            );
          }

          instances.push({
            ...processoResponse,
            grau: i === 1 ? 'PRIMEIRO_GRAU' : 'SEGUNDO_GRAU',
          });
        } catch (err) {
          this.logger.warn(
            `Falha ao buscar instância ${i} para o processo ${numeroDoProcesso}: ${err.message}`,
          );
          // Continua para a próxima instância sem quebrar o loop
          continue;
        }
      }

      const itensProcesso =
        instances
          .flatMap((instancia) =>
            instancia.itensProcesso.map((docs) => {
              return {
                ...docs,
                instancia: instancia.grau,
                instanciaId: instancia.id,
              };
            }),
          )
          .filter((item) => item !== null) || [];
      const normalizeDocsRestrict = normalizeDocsResponse(
        regionTRT,
        itensProcesso as ItensProcesso[],
      );
      const documentosRestritos: DocumentosRestritos[] =
        await this.uploadDocumentosRestritos(normalizeDocsRestrict, regionTRT);
      instances.forEach((instance) => {
        instance.documentos_restritos = documentosRestritos.filter(
          (doc) => doc.instanciaId === instance.id,
        );
      });
      console.log('Instances:', instances);
      return normalizeResponse(numeroDoProcesso, instances, '', true);
    } catch (error) {
      const login = await this.loginService.execute(regionTRT);
      cookies = login.cookies;

      await redis.set('pje:auth:cookies', cookies);

      return await this.execute(numeroDoProcesso);
    }
  }
  async fetchProcess(
    numeroDoProcesso: string,
    detalheProcessoId: string,
    instance: string,
    tockenCaptcha?: string,
    tokenDesafio?: string,
    resposta?: string,
  ) {
    const regionTRT = Number(numeroDoProcesso.split('.')[3]);
    const cookies = await redis.get('pje:auth:cookies');
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
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
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

  async uploadDocumentosRestritos(
    documentos: DocumentosRestritos[],
    regionTRT: number,
  ): Promise<DocumentosRestritos[]> {
    const uploadedDocuments: DocumentosRestritos[] = [];

    for (const documento of documentos) {
      try {
        const buffer = await this.documentoService.execute(
          documento.instanciaId,
          documento.documentoId,
          regionTRT,
          documento.instancia,
        );
        const fileName = `${documento.documentoId}.pdf`;
        const url = await this.awsS3Service.uploadPdf(buffer, fileName);
        uploadedDocuments.push({ ...documento, link_api: url });
      } catch (error) {
        this.logger.error(
          `Erro ao fazer upload do documento ${documento.documentoId}:`,
          error,
        );
      }
    }

    return uploadedDocuments;
  }
}
