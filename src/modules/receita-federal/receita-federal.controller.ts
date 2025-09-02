import { Controller, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyAuthGuard } from 'src/guards/api-key.guard';
import { CndtScraperService } from './services/cndt-scraper.service';
import { CnpjScraperService } from './services/find.service';

@Controller('receita-federal')
export class ReceitaFederalController {
  constructor(
    private readonly cnpjScraperService: CnpjScraperService,
    private readonly cndtScraperService: CndtScraperService,
  ) {}
  @UseGuards(ApiKeyAuthGuard)
  @Post()
  async getStatus(@Query('cnpj') cnpj: string, @Res() res: Response) {
    const pdfBuffer = await this.cnpjScraperService.execute(cnpj);
    if (!pdfBuffer) {
      return res
        .status(404)
        .json({ message: 'CNPJ não encontrado ou inválido.' });
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cnpj}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
  @UseGuards(ApiKeyAuthGuard)
  @Post('/cndt')
  getCndt(@Query('cnpj') cnpj: string) {
    this.cndtScraperService.execute(cnpj);
    return { message: 'Processo iniciado' };
  }
}
