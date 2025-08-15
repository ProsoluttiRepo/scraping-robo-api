import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PjeController } from './pje.controller';
import { ConsultarProcessoQueue } from './queues/service/consultar-processo';
import { CaptchaService } from './services/captcha.service';
import { DocumentoService } from './services/documents.service';
import { PjeLoginService } from './services/login.service';
import { ProcessDocumentsFindService } from './services/process-documents-find.service';
import { ProcessFindService } from './services/process-find.service';
import { ConsultarProcessoService } from './queues/processor/consultar-processo';
import { ConsultarProcessoDocumentoQueue } from './queues/service/consultar-processo-documento';
import { ConsultarProcessoDocumentoService } from './queues/processor/consultar-processo-documento';
import { AwsS3Service } from 'src/services/aws-s3.service';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'pje-queue',
      limiter: { max: 2, duration: 1000 },
    }),
  ],
  controllers: [PjeController],
  providers: [
    PjeLoginService,
    ProcessDocumentsFindService,
    CaptchaService,
    ProcessFindService,
    DocumentoService,
    ConsultarProcessoQueue,
    ConsultarProcessoService,
    ConsultarProcessoDocumentoQueue,
    ConsultarProcessoDocumentoService,
    AwsS3Service,
  ],
  exports: [],
})
export class PjeModule {}
