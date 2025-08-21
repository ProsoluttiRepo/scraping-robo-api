import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessDocumentsFindService } from '../../services/process-documents-find.service';
import axios from 'axios';
import redis from 'src/shared/redis';

@Injectable()
@Processor('pje-queue')
export class ConsultarProcessoDocumentoService {
  logger = new Logger(ConsultarProcessoDocumentoService.name);
  constructor(
    private readonly processDocumentsFindService: ProcessDocumentsFindService,
  ) {}

  @Process({
    name: 'consulta-processo-documento',
    concurrency: 5,
  })
  async execute(job: Job<{ numero: string }>) {
    const { numero } = job.data;
    try {
      this.logger.log(
        `Iniciando consulta de documentos para o processo: ${numero}`,
      );
      const keys = await redis.keys('pje:token:*'); // busca todas que começam com pje:token:
      if (keys.length > 0) {
        await redis.del(...keys); // deleta todas
      }

      const response = await this.processDocumentsFindService.execute(numero);
      if (response?.resposta?.instancias?.length) {
        console.log(
          'RESPONSE 1',
          response.resposta.instancias[0]?.documentos_restritos,
        );
        if (response.resposta.instancias.length > 1) {
          console.log(
            'RESPONSE 2',
            response.resposta.instancias[1]?.documentos_restritos,
          );
        }
      } else {
        console.log('RESPONSE', 'Instancias não encontradas ou indefinidas');
      }

      const webhookUrl = process.env.WEBHOOK_URL || '';
      // await axios.post(webhookUrl, response, {
      //   headers: {
      //     Authorization: `${process.env.AUTHORIZATION_ESCAVADOR || ''}`,
      //   },
      // });
    } catch (error) {
      console.error('Erro ao processar o documento:', error);
      throw error; // Re-throw the error to ensure the job fails
    }
  }
}
