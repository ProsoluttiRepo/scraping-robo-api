import { Controller, Get, Param, Post } from '@nestjs/common';
import { ConsultarProcessoQueue } from './queues/service/consultar-processo';
import { ConsultarProcessoDocumentoQueue } from './queues/service/consultar-processo-documento';

@Controller('processos')
export class PjeController {
  constructor(
    private readonly consultarProcessoQueue: ConsultarProcessoQueue,
    private readonly consultarProcessoDocumentoQueue: ConsultarProcessoDocumentoQueue,
  ) {}
  @Post('/:numero')
  async getFindProcess(@Param('numero') numero: string): Promise<any> {
    return this.consultarProcessoQueue.execute(numero);
  }
  // @Post('/:numero')
  // async getFindProcess(@Body() processes: string[]): Promise<any> {
  //   for (const numero of processes) {
  //     // this.consultarProcessoQueue.execute(numero);
  //     await this.consultarProcessoQueue.execute(numero);
  //   }
  // }
  @Post('/:numero/documentos')
  async getFindProcessDocuments(@Param('numero') numero: string): Promise<any> {
    return this.consultarProcessoDocumentoQueue.execute(numero);
  }
  @Get('')
  getDocument() {
    return 'ok';
    //   const buffer = await this.documentoService.execute(
    //     212895,
    //     28759914,
    //     18,
    //     'SEGUNDO_GRAU',
    //   );
    //   res.set({
    //     'Content-Type': 'application/pdf',
    //     'Content-Disposition': `attachment; filename="documento-59146608.pdf"`,
    //   });
    //   res.send(buffer);
  }
}
