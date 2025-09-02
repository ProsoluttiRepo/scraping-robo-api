import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyAuthGuard } from 'src/guards/api-key.guard';
import { CnpjScraperService } from './services/find.service';
import { CndtScraperService } from './services/cndt-scraper.service';

@Controller('receita-federal')
export class ReceitaFederalController {
  constructor(
    private readonly cnpjScraperService: CnpjScraperService,
    private readonly cndtScraperService: CndtScraperService,
  ) {}
  @UseGuards(ApiKeyAuthGuard)
  @Get()
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
  @Get('/cndt')
  async getCndt(@Query('cnpj') cnpj: string, @Res() res: Response) {
    const pdfBuffer = await this.cndtScraperService.execute(cnpj);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cnpj}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}
