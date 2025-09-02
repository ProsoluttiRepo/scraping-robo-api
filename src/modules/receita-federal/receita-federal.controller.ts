import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyAuthGuard } from 'src/guards/api-key.guard';
import { CaptchaService } from './services/captcha.service';
import { CnpjScraperService } from './services/find.service';

@Controller('receita-federal')
export class ReceitaFederalController {
  constructor(
    private readonly cnpjScraperService: CnpjScraperService,
    private readonly captchaService: CaptchaService,
  ) {}
  @UseGuards(ApiKeyAuthGuard)
  @Get()
  async getStatus(@Query('cnpj') cnpj: string, @Res() res: Response) {
    const pdfBuffer = await this.cnpjScraperService.execute(cnpj);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cnpj}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
  @Get('captcha/solve')
  async solve(
    @Query('siteKey') siteKey: string,
    @Query('pageUrl') pageUrl: string,
  ) {
    const token = await this.captchaService.solve2Captcha(
      siteKey,
      pageUrl,
      `hcaptcha`,
    );
    return { token };
  }
}
