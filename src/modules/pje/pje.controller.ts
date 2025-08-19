import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConsultarProcessoQueue } from './queues/service/consultar-processo';
import { ConsultarProcessoDocumentoQueue } from './queues/service/consultar-processo-documento';
import { DocumentoService } from './services/documents.service';

@Controller('processos')
export class PjeController {
  constructor(
    private readonly consultarProcessoQueue: ConsultarProcessoQueue,
    private readonly consultarProcessoDocumentoQueue: ConsultarProcessoDocumentoQueue,
    private readonly documentoService: DocumentoService,
  ) {}
  @Post('/:numero')
  async getFindProcess(@Param('numero') numero: string): Promise<any> {
    return this.consultarProcessoQueue.execute(numero);
  }
  @Post('/:numero/documentos')
  async getFindProcessDocuments(@Param('numero') numero: string): Promise<any> {
    return this.consultarProcessoDocumentoQueue.execute(numero);
  }
  @Get('/documento')
  async getDocument(@Res() res: Response): Promise<any> {
    const buffer = await this.documentoService.execute(
      212895,
      28759914,
      18,
      'SEGUNDO_GRAU',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="documento-59146608.pdf"`,
    });
    res.send(buffer);
  }
}
