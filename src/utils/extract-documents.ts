import axios from 'axios';
import * as fs from 'fs';
import { createWriteStream } from 'node:fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { PDFDocument } from 'pdf-lib';
import redis from 'src/shared/redis';

export async function extractDocuments(
  processId: string,
  documentId: string,
  instance: string,
  tokenCaptcha: string,
  numeroDoProcesso: string,
) {
  const cookies = (await redis.get('pje:auth:cookies')) || '';
  const uploadPath = path.resolve('tmp');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const new_file_path = `tmp/file_${Date.now()}.pdf`;
  return await downloadFile(
    `${process.env.BASE_URL_PJE}/processos/${processId}/documentos/${documentId}?tokenCaptcha=${tokenCaptcha}`,
    new_file_path,
    cookies,
    instance,
    numeroDoProcesso,
  );
  const isInvalidPdf = await isPdfEmptyOrCorrupt(new_file_path);
  if (isInvalidPdf) {
    console.log(`Documento está vazio ou inválido.`);
    return;
  }
  return new_file_path;
}
async function isPdfEmptyOrCorrupt(filePath: string): Promise<boolean> {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    // Tenta carregar o PDF
    const pdfDoc = await PDFDocument.load(fileBuffer);

    // Verifica se há páginas no PDF
    if (pdfDoc.getPageCount() === 0) {
      console.log(pdfDoc.getPageCount());
      console.log('PDF está vazio.');
      return true;
    }

    return false; // PDF não está vazio e não é inválido
  } catch (error) {
    console.error('Erro ao carregar o PDF:', error.message);
    return true; // Considera como inválido em caso de erro
  }
}

async function downloadFile(
  url: string,
  localFilePath: string,
  cookie: string,
  instance: string,
  numeroDoProcesso?: string,
) {
  try {
    const response = await axios.get(url, {
      headers: {
        Cookie: cookie,
        'x-grau-instancia': instance,
        referer: `https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/${numeroDoProcesso}/1`,
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      responseType: 'stream',
    });

    return response.data;

    const writer = createWriteStream(localFilePath);
    await pipeline(response.data, writer);

    console.log(`Documento salvo em: ${localFilePath}`);
  } catch (error) {
    console.error(`Erro ao baixar o arquivo: ${error.message}`);
    throw error;
  }
}
