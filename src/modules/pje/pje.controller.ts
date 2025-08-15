import { Controller, Param, Post } from '@nestjs/common';
import { ConsultarProcessoQueue } from './queues/service/consultar-processo';
import { ConsultarProcessoDocumentoQueue } from './queues/service/consultar-processo-documento';
import { ProcessDocumentsFindService } from './services/process-documents-find.service';

@Controller('processos')
export class PjeController {
  constructor(
    private readonly consultarProcessoQueue: ConsultarProcessoQueue,
    private readonly consultarProcessoDocumentoQueue: ConsultarProcessoDocumentoQueue,
    private readonly processDocumentsFindService: ProcessDocumentsFindService,
  ) {}
  @Post('/:numero')
  async getFindProcess(@Param('numero') numero: string): Promise<any> {
    return this.consultarProcessoQueue.execute(numero);
  }
  @Post('/:numero/documentos')
  async getFindProcessDocuments(@Param('numero') numero: string): Promise<any> {
    console.log(`Número do processo: ${numero}`);
    return this.processDocumentsFindService.execute(numero);
  }
}
