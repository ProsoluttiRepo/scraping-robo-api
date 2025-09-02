// workers/processos.worker.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { ProcessFindService } from '../../services/process-find.service';

@Processor('pje-processos', { concurrency: 5, lockDuration: 600000 }) // paralelo
export class ProcessosWorker extends WorkerHost {
  private readonly logger = new Logger(ProcessosWorker.name);

  constructor(private readonly processFindService: ProcessFindService) {
    super();
  }

  async process(job: Job<{ numero: string; origem: string }>) {
    const { numero, origem } = job.data;
    this.logger.log(`📄 Consultando processo ${numero}`);
    const response = await this.processFindService.execute(numero, origem);
    console.log('response', response);

    const webhookUrl = `${process.env.WEBHOOK_URL}/process/webhook`;
    await axios.post(webhookUrl, response, {
      headers: { Authorization: `${process.env.AUTHORIZATION_ESCAVADOR}` },
    });
  }
}
