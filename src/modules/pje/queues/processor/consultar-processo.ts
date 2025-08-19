import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessFindService } from '../../services/process-find.service';
import axios from 'axios';

@Injectable()
@Processor('pje-queue')
export class ConsultarProcessoService {
  private readonly logger = new Logger(ConsultarProcessoService.name);

  constructor(private readonly processFindService: ProcessFindService) {}
  @Process({
    name: 'consulta-processo',
    concurrency: 3,
  })
  async execute(job: Job<{ numero: string }>) {
    const { numero } = job.data;
    try {
      this.logger.log(`Iniciando consulta do processo: ${numero}`);
      const response = await this.processFindService.execute(numero);
      const webhookUrl = process.env.WEBHOOK_URL || '';

      await axios.post(webhookUrl, response, {
        headers: {
          Authorization: `${process.env.AUTHORIZATION_ESCAVADOR || ''}`,
        },
      });
    } catch (error) {
      this.logger.error('Erro ao processar número: ', error);
    }
  }
}
