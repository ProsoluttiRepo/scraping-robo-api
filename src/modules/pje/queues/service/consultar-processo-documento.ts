// pje.service.ts
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class ConsultarProcessoDocumentoQueue {
  constructor(@InjectQueue('pje-queue') private readonly pjeQueue: Queue) {}
  async execute(numero: string) {
    await this.pjeQueue.add(
      'consulta-processo-documento',
      { numero },
      {
        attempts: 3, // até 3 tentativas se falhar
        backoff: 5000, // espera 5s antes de tentar de novo
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    return { status: 'enfileirado', numero };
  }
}
