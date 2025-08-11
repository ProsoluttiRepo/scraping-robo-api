import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ProcessDocumentsFindService } from './services/process-documents-find.service';
import { ProcessFindService } from './services/process-find.service';
import { DocumentoService } from './services/documents.service';
import { Response } from 'express';
import { TestService } from './services/test.service';

@Controller('pje')
export class PjeController {
  constructor(
    private readonly processDocumentsFindService: ProcessDocumentsFindService,
    private readonly processFindService: ProcessFindService,
    private readonly documentoService: DocumentoService,
    private readonly testService: TestService,
  ) {}
  @Get('find-process')
  async getFindProcess(
    @Query('numeroDoProcesso') numeroDoProcesso: string,
    @Query('instance') instance: string = '1',
  ): Promise<any> {
    return await this.testService.execute();
  }
  @Get('find-process-documents')
  async getFindProcessDocuments(
    @Query('numeroDoProcesso') numeroDoProcesso: string,
    @Query('instance') instance: string = '1',
  ): Promise<any> {
    console.log(`Número do processo: ${numeroDoProcesso}`);
    return await this.processDocumentsFindService.execute(
      numeroDoProcesso,
      instance,
    );
  }
  @Get('documento/:id')
  async getDocumento(@Param('id') id: string, @Res() res: Response) {
    const documentoId = Number(id);
    if (isNaN(documentoId)) {
      return res.status(400).send('ID inválido');
    }
    const buffer = await this.documentoService.execute(documentoId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="documento-${documentoId}.pdf"`,
    });
    res.send(buffer);
  }
}
