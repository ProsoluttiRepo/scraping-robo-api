import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Job } from 'bullmq';
import { ProcessFindService } from '../../services/process-find.service';

@Injectable()
@Processor('pje-queue')
export class ConsultarProcessoService {
  private readonly logger = new Logger(ConsultarProcessoService.name);

  constructor(private readonly processFindService: ProcessFindService) {}

  @Process({
    name: 'consulta-processo',
  })
  async execute(job: Job<{ numero: string }>) {
    const { numero } = job.data;
    try {
      this.logger.log(`Iniciando consulta do processo: ${numero}`);
      const response = await this.processFindService.execute(numero);
      this.logger.log('RESPONSE', response);

      const webhookUrl = process.env.WEBHOOK_URL || '';
      this.logger.log('REPONSE', response);
      await axios.post(webhookUrl, response, {
        headers: {
          Authorization: `${process.env.AUTHORIZATION_ESCAVADOR || ''}`,
        },
      });
    } catch (error) {
      this.logger.error('Erro ao processar número: ', error);
    }
  }

  // private adicionarNaPlanilha(numero: string, response: any) {
  //   try {
  //     let workbook;
  //     let worksheet;

  //     // Verifica se a planilha já existe
  //     if (fs.existsSync(this.planilhaPath)) {
  //       workbook = XLSX.readFile(this.planilhaPath);
  //       worksheet =
  //         workbook.Sheets['Processos'] ||
  //         workbook.Sheets[workbook.SheetNames[0]];
  //     } else {
  //       // Cria uma nova planilha
  //       workbook = XLSX.utils.book_new();
  //       worksheet = XLSX.utils.aoa_to_sheet([
  //         [
  //           'Número do Processo',
  //           'Data Consulta',
  //           'Status',
  //           'Nome',
  //           'Tipo',
  //           'Documento',
  //         ],
  //       ]);
  //       XLSX.utils.book_append_sheet(workbook, worksheet, 'Processos');
  //     }

  //     // Converte a worksheet para array de objetos para facilitar manipulação
  //     const dataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  //     const data: any[][] = Array.isArray(dataRaw) ? (dataRaw as any[][]) : [];

  //     // Adiciona nova linha com os dados
  //     const novaLinha = [
  //       numero,
  //       new Date().toISOString(),
  //       response.status || 'Consultado',
  //       response.nome || 'Reclamada não encontrada',
  //       response.tipo || 'Tipo não encontrado',
  //       response.documento.numero || 'Documento não encontrado',
  //     ];

  //     data.push(novaLinha);

  //     // Recria a worksheet com os novos dados
  //     const novaWorksheet = XLSX.utils.aoa_to_sheet(data);
  //     workbook.Sheets['Processos'] = novaWorksheet;

  //     // Salva a planilha
  //     XLSX.writeFile(workbook, this.planilhaPath);

  //     this.logger.log(`Dados do processo ${numero} adicionados à planilha`);
  //   } catch (error) {
  //     this.logger.error('Erro ao adicionar dados na planilha:', error);
  //   }
  // }
}
