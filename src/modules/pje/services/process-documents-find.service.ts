// src/modules/pje/services/process-find.service.ts

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import { DetalheProcesso, Documento, ProcessosResponse } from 'src/interfaces';
import { Root } from 'src/interfaces/normalize';
import { AwsS3Service } from 'src/services/aws-s3.service';
import redis from 'src/shared/redis';
import { normalizeString } from 'src/utils/normalize-string';
import { normalizeResponse } from 'src/utils/normalizeResponse';
import { userAgents } from 'src/utils/user-agents';
import { DocumentoService } from './documents.service';
import { PdfExtractService } from './extract.service';
import { PjeLoginService } from './login.service';
import { CaptchaService } from 'src/services/captcha.service';
@Injectable()
export class ProcessDocumentsFindService {
  logger = new Logger(ProcessDocumentsFindService.name);

  constructor(
    private readonly loginService: PjeLoginService,
    private readonly captchaService: CaptchaService,
    private readonly documentoService: DocumentoService,
    private readonly awsS3Service: AwsS3Service,
    private readonly pdfExtractService: PdfExtractService,
  ) {}
  // 🔹 Contas disponíveis
  private contas = [
    {
      username: process.env.PJE_USER_FIRST as string,
      password: process.env.PJE_PASS_FIRST as string,
    },
    {
      username: process.env.PJE_USER_SECOND as string,
      password: process.env.PJE_PASS_SECOND as string,
    },
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
    const { username, password } = this.getConta();
    console.log({ regionTRT, username, password });
    try {
      const tokenCaptcha = await redis.get('pje:token:captcha');
      // 🔹 Escolhe a conta atual

      const { cookies } = await this.loginService.execute(
        regionTRT,
        username,
        password,
      );
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

      const instances: ProcessosResponse[] = [];
      for (let i = 1; i <= 3; i++) {
        try {
          // Delay antes da requisição de dados básicos
          const delayMs = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000; // 5 a 10s
          this.logger.debug(
            `⏱ Delay de ${delayMs}ms antes de dar inicio a ${i}ª instância`,
          );
          await this.delay(delayMs);
          const typeUrl = i === 3 ? 'tst' : `trt${regionTRT}`; // --- IGNORE ---

          const responseDadosBasicos = await axios.get<DetalheProcesso[]>(
            `https://pje.${typeUrl}.jus.br/pje-consulta-api/api/processos/dadosbasicos/${numeroDoProcesso}`,
            {
              headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
                'x-grau-instancia': i.toString(),
                referer: `https://pje.${typeUrl}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${i}`,
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
              cookies,
            );
          }

          instances.push({
            ...processoResponse,
            grau: i === 1 ? 'PRIMEIRO_GRAU' : 'SEGUNDO_GRAU',
            instance: i.toString(),
          });
        } catch (err) {
          this.logger.warn(
            `Falha ao buscar instância ${i} para o processo ${numeroDoProcesso}: ${err.message}`,
          );
          continue;
        }
      }

      const documentosRestritos = await this.uploadDocumentosRestritos(
        regionTRT,
        cookies,
        instances,
        numeroDoProcesso,
      );
      const newInstances = instances.map((instance) => {
        return {
          ...instance,
          documentos: documentosRestritos,
        };
      });

      return normalizeResponse(numeroDoProcesso, newInstances, '', true);
    } catch (error) {
      if (error.response?.data?.codigoErro === 'ARQ-028') {
        this.logger.warn(
          `Erro ARQ-028 com ${username}, tentando novamente mesma conta...`,
        );
        if (tentativas >= 1) {
          return normalizeResponse(
            numeroDoProcesso,
            [],
            'ANÁLISE - FALHA AO TENTAR ACESSAR INFORMAÇÕES, TENTE NOVAMENTE MAIS TARDE',
          );
        }

        // 🔹 tenta logar de novo com a MESMA conta
        await this.loginService.execute(regionTRT, username, password, true);
        return await this.execute(numeroDoProcesso, tentativas + 1);
      }

      // 🔹 Para outros erros → troca de conta
      if (tentativas < this.contas.length) {
        this.logger.warn(
          `⚠️ Erro com a conta ${username}, tentando próxima conta...`,
        );

        // força troca de conta
        const { username: newUser, password: newPass } = this.getConta(true);
        if (username === newUser) {
          // se só tiver uma conta configurada, não entra em loop infinito
          return normalizeResponse(
            numeroDoProcesso,
            [],
            'ANÁLISE - FALHA AO TENTAR ACESSAR INFORMAÇÕES, TENTE NOVAMENTE MAIS TARDE',
          );
        }
        await this.loginService.execute(regionTRT, newUser, newPass, true);
        return await this.execute(numeroDoProcesso, tentativas + 1);
      }

      // 🔹 Se já tentou todas as contas, falha de vez
      return normalizeResponse(
        numeroDoProcesso,
        [],
        'ANÁLISE - FALHA AO TENTAR ACESSAR INFORMAÇÕES, TENTE NOVAMENTE MAIS TARDE',
      );
    }
  }

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
    const typeUrl = instance === '3' ? 'tst' : `trt${regionTRT}`; // --- IGNORE ---
    try {
      let url = `https://pje.${typeUrl}.jus.br/pje-consulta-api/api/processos/${detalheProcessoId}`;
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
          referer: `https://pje.${typeUrl}.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/${instance}`,
          'user-agent':
            userAgents[Math.floor(Math.random() * userAgents.length)],
          cookie: cookies,
        },
      });

      const tokenCaptcha: string = response.headers['captchatoken'] as string;
      if (tokenCaptcha) {
        const captchaKey = `pje:token:captcha:${instance}`;

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
    regionTRT: number,
    cookies: string,
    instances: ProcessosResponse[],
    processNumber: string,
  ): Promise<Documento[]> {
    this.logger.debug(`🔒 Iniciando upload de documentos restritos...`);

    const uploadedDocuments: Documento[] = [];
    const processedDocumentIds = new Set<string>(); // para evitar duplicidade
    const delayMs = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000; // 5 a 10s

    // Regex para tipos de documentos seguindo o modelo /.*palavra1.*palavra2.*/i
    const regexDocumentos = [
      // Processo principal / execução
      /.*peticao.*inicial.*/i,
      /.*sentenca.*/i,
      /.*embargos.*de.*declaracao.*/i,
      /.*recurso.*ordinario.*/i,
      /.*acordao.*/i,
      /.*recurso.*de.*revista.*/i,
      /.*decisao.*de.*admissibilidade.*/i,
      /.*agravo.*de.*instrumento.*/i,
      /.*decisao.*/i,
      /.*decisao.*\/.*acordao.*/i,
      /.*agravo.*interno.*/i,
      /.*recurso.*extraordinario.*/i,
      /.*planilha.*de.*calculo.*/i,
      /.*embargos.*a.*execucao.*/i,
      /.*agravo.*de.*peticao.*/i,

      // Documentos aleatórios antes da sentença
      /.*procuracao.*/i,
      /.*habilitacao.*/i,
      /.*substabelecimento.*/i,

      // Documentos aleatórios após a sentença
      /.*manifestacao.*/i,
      /.*ccb.*/i,
      /.*cessao.*/i,
      /.*alvara.*/i,
      /.*transito.*em.*julgado.*/i,
      /.*peticionamentos.*avulsos.*/i,
      /.*decisoes.*/i,
      /.*despachos.*/i,
      /.*intimacoes.*/i,

      // Primeira instância
      /.*prevencao.*/i,
    ];

    try {
      // 1️⃣ Baixa todos os PDFs das instâncias
      const buffersPorInstancia: { [instanciaId: string]: Buffer } = {};
      for (const instance of instances) {
        this.logger.debug(
          `⏱ Delay de ${delayMs}ms antes de buscar documento da ${instance.instance}ª instância`,
        );
        await this.delay(delayMs);

        const filePath = await this.documentoService.execute(
          instance.id,
          regionTRT,
          instance.instance,
          cookies,
          processNumber,
        );

        const fileBuffer = fs.readFileSync(filePath);
        buffersPorInstancia[instance.id] = fileBuffer;

        // Remove arquivo temporário
        try {
          fs.unlinkSync(filePath);
          this.logger.debug(
            `Arquivo temporário ${filePath} deletado com sucesso`,
          );
        } catch (err) {
          this.logger.warn(
            `Não foi possível deletar ${filePath}: ${err.message}`,
          );
        }
      }

      // 2️⃣ Para cada PDF, extrai bookmarks dos tipos desejados
      for (const [, buffer] of Object.entries(buffersPorInstancia)) {
        const bookmarks = await this.pdfExtractService.extractBookmarks(buffer);

        // Filtra bookmarks usando regex
        const bookmarksFiltrados = bookmarks.filter((b) =>
          regexDocumentos.some((r) => r.test(normalizeString(b.title))),
        );

        for (const bookmark of bookmarksFiltrados) {
          // Checa se já foi processado
          if (processedDocumentIds.has(bookmark.id)) {
            this.logger.debug(
              `Documento "${bookmark.title}" (id: ${bookmark.id}) já processado, pulando.`,
            );
            continue;
          }

          // Extrai páginas correspondentes
          const extractedPdfBuffer =
            await this.pdfExtractService.extractPagesByIndex(
              buffer,
              bookmark.id,
            );

          if (extractedPdfBuffer) {
            const fileName = `${bookmark.title.replace(/\s+/g, '_')}_${bookmark.index}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
            const url = await this.awsS3Service.uploadPdf(
              extractedPdfBuffer,
              fileName,
            );

            uploadedDocuments.push({
              title: bookmark.title,
              temp_link: url,
              uniqueName: bookmark.id,
              date: bookmark.data,
            });

            processedDocumentIds.add(bookmark.id); // marca como processado
          } else {
            this.logger.warn(
              `Não foi possível extrair o buffer PDF para o bookmark "${bookmark.title}" (id: ${bookmark.id})`,
            );
          }
        }
      }

      return uploadedDocuments;
    } catch (error) {
      this.logger.error('Erro ao fazer upload dos documentos restritos', error);
      return [];
    }
  }
}
