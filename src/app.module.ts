import { Module } from '@nestjs/common';

import { PjeModule } from './modules/pje/pje.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PjeModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
