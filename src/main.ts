import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 8081;
  app.enableCors({
    origin: ['https://api.analisesprosolutti.com'],
    credentials: true, // Permite o envio de cookies
  });
  await app.listen(port);
}
bootstrap();
