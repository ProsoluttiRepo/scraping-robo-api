import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessFindService } from '../../services/process-find.service';

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
    const result = await this.processFindService.execute(numero);
    // this.logger.log('Processando número: ', result);
  }
}
