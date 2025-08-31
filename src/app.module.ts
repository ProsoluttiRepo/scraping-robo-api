import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

import { PjeModule } from './modules/pje/pje.module';

@Module({
  imports: [
    PjeModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    // se quiser, registra as filas explicitamente
    BullModule.registerQueue(
      { name: 'pje-documentos' }, // fila de documentos (concurrency 1)
      { name: 'pje-processos' }, // fila de processos (paralela)
    ),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
