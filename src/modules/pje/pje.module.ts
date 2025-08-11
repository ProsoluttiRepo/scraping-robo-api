import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PjeController } from './pje.controller';
import { CaptchaService } from './services/captcha.service';
import { PjeLoginService } from './services/login.service';
import { ProcessDocumentsFindService } from './services/process-documents-find.service';
import { ProcessFindService } from './services/process-find.service';
import { DocumentoService } from './services/documents.service';
import { TestService } from './services/test.service';

@Module({
  imports: [HttpModule],
  controllers: [PjeController],
  providers: [
    PjeLoginService,
    ProcessDocumentsFindService,
    CaptchaService,
    ProcessFindService,
    DocumentoService,
    TestService,
  ],
  exports: [],
})
export class PjeModule {}
