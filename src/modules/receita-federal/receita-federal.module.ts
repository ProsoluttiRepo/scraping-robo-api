import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ReceitaFederalController } from './receita-federal.controller';
import { CnpjScraperService } from './services/find.service';
import { CndtScraperService } from './services/cndt-scraper.service';
import { CaptchaService } from 'src/services/captcha.service';
import { ReCaptchaService } from './services/recaptcha.service';

@Module({
  imports: [HttpModule],
  controllers: [ReceitaFederalController],
  providers: [
    CnpjScraperService,
    CaptchaService,
    CndtScraperService,
    ReCaptchaService,
  ],
})
export class ReceitaFederalModule {}
