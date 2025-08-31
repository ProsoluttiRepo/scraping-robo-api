import { Controller, Param, Post, Query } from '@nestjs/common';
import { ConsultarProcessoQueue } from './queues/service/consultar-processo';
import { ConsultarProcessoDocumentoQueue } from './queues/service/consultar-processo-documento';
import { DocumentoService } from './services/documents.service';
import { PdfExtractService } from './services/extract.service';
@Controller('processos')
export class PjeController {
  constructor(
    private readonly consultarProcessoQueue: ConsultarProcessoQueue,
    private readonly consultarProcessoDocumentoQueue: ConsultarProcessoDocumentoQueue,
    private readonly documentoService: DocumentoService,
    private readonly pdfService: PdfExtractService,
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
  // @Get('documents')
  // async getDocument(@Res() res: Response) {
  //   const pdfBuffer = await this.documentoService.execute(
  //     5294215,
  //     2,
  //     '1',
  //     'cookie',
  //     '1000779-30.2023.5.02.0040',
  //   );

  //   res.set({
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': `attachment; filename=trecho.pdf`,
  //     'Content-Length': pdfBuffer.length,
  //   });

  //   res.send(pdfBuffer);
  // }
  // @Post('extract')
  // @UseInterceptors(FileInterceptor('file'))
  // async extractByIndex(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body('documentId') documentId: string,
  //   @Res() res: Response,
  // ) {
  //   const pdfBuffer = await this.pdfService.extractPagesByIndex(
  //     file.buffer, // usando buffer direto
  //     documentId,
  //   );
  //   if (!pdfBuffer) {
  //     return res
  //       .status(400)
  //       .json({ error: 'Falha ao extrair páginas do PDF.' });
  //   }
  //   res.set({
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': `attachment; filename=trecho.pdf`,
  //     'Content-Length': pdfBuffer.length,
  //   });
  //   res.end(pdfBuffer);
  // }
  // @Post('bookmarks')
  // @UseInterceptors(FileInterceptor('file'))
  // async extractBookmarks(@UploadedFile() file: Express.Multer.File) {
  //   if (!file) {
  //     return { error: 'Nenhum arquivo enviado' };
  //   }

  //   const bookmarks = await this.pdfService.extractBookmarks(file.buffer);
  //   return { bookmarks };
  // }
}
