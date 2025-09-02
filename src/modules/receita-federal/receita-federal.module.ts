import { Module } from '@nestjs/common';
import { ReceitaFederalController } from './receita-federal.controller';
import { CnpjScraperService } from './services/find.service';
import { HttpModule } from '@nestjs/axios';
import { CaptchaService } from './services/captcha.service';

@Module({
  imports: [HttpModule],
  controllers: [ReceitaFederalController],
  providers: [CnpjScraperService, CaptchaService],
})
export class ReceitaFederalModule {}
