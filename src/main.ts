import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 8081;
  app.enableCors({
    origin: ['https://api.analisesprosolutti.com'],
    credentials: true, // Permite o envio de cookies
  });
  if (process.env?.ENVIRONMENT !== 'production') {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/bull-board');
    const aQueue = app.get<Queue>(`BullQueue_pje-documentos`);
    createBullBoard({
      queues: [new BullAdapter(aQueue)],
      serverAdapter,
    });
    app.use('/bull-board', serverAdapter.getRouter());
  }
  await app.listen(port);
}
bootstrap();
