import { Controller, Param, Post, Query } from '@nestjs/common';
import { ConsultarProcessoQueue } from './queues/service/consultar-processo';
import { ConsultarProcessoDocumentoQueue } from './queues/service/consultar-processo-documento';
@Controller('processos')
export class PjeController {
  constructor(
    private readonly consultarProcessoQueue: ConsultarProcessoQueue,
    private readonly consultarProcessoDocumentoQueue: ConsultarProcessoDocumentoQueue,
  ) {}
  @Post('/:numero')
  async getFindProcess(
    @Param('numero') numero: string,
    @Query('origem') origem: string,
  ): Promise<any> {
    return this.consultarProcessoQueue.execute(numero, origem);
  }
  @Post('/:numero/documentos')
  async getFindProcessDocuments(@Param('numero') numero: string): Promise<any> {
    return this.consultarProcessoDocumentoQueue.execute(numero);
  }
}
