import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { PjeModule } from './modules/pje/pje.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PjeModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
