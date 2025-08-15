import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessDocumentsFindService } from '../../services/process-documents-find.service';

@Injectable()
@Processor('pje-queue')
export class ConsultarProcessoDocumentoService {
  constructor(
    private readonly processDocumentsFindService: ProcessDocumentsFindService,
  ) {}

  @Process({
    name: 'consulta-processo-documento',
    concurrency: 1,
  })
  async execute(job: Job<{ numero: string }>) {
    const { numero } = job.data;
    console.log('Processando número: ', numero);
    await this.processDocumentsFindService.execute(numero);
  }
}
