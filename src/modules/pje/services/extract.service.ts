import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { normalizeString } from 'src/utils/normalize-string';
@Injectable()
export class PdfExtractService {
  logger = new Logger(PdfExtractService.name);

  /**
   * Extrai páginas de um PDF baseado em índices
   * @param fileBuffer Buffer do PDF
   * @param startPage primeira página (1-based)
   * @param endPage última página (1-based)
   */
  async extractPagesByIndex(fileBuffer: Buffer, documentId: string) {
    const bookmarks = await this.extractBookmarks(fileBuffer);

    const bookmark = bookmarks.find(
      (b) => normalizeString(b.id) === normalizeString(documentId),
    );

    if (!bookmark) {
      this.logger.error(`Bookmark matching "${documentId}" not found.`);
      return;
    }
    const { startPage, endPage } = bookmark;

    const pdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = pdfDoc.getPageCount();

    // validação de índices
    const start = Math.max(startPage, 1);
    const end = Math.min(endPage, totalPages);

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i),
    );
    pages.forEach((p) => newPdf.addPage(p));

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes);
  }
  async extractBookmarks(buffer: Buffer): Promise<
    {
      title: string;
      startPage: number;
      endPage: number;
      index: number;
      data: string;
      id: string;
    }[]
  > {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    const outline = await pdf.getOutline();
    if (!outline) {
      return [];
    }

    const bookmarks: {
      title: string;
      startPage: number;
      endPage: number;
      index: number;
      data: string;
      id: string;
    }[] = [];

    for (const item of outline) {
      let dest: any;

      if (typeof item.dest === 'string') {
        dest = await pdf.getDestination(item.dest);
      } else if (Array.isArray(item.dest)) {
        dest = item.dest; // já vem resolvido
      }

      const parts = item.title.split(' - ');

      let id: string = '';
      let index = 0;
      let date: string = '';
      let description = '';

      if (parts.length >= 3) {
        // Assume que o último pedaço é o ID
        id = parts[parts.length - 1].trim();
        description = parts.slice(1, -1).join(' - ').trim();
      } else if (parts.length === 2) {
        description = parts[1].trim();
      } else {
        description = parts[0].trim();
      }

      // Extrair índice e data do primeiro pedaço
      const firstPart = parts[0].trim();
      const matchWithIndex = firstPart.match(
        /^(\d+)\.\s*(\d{2}\/\d{2}\/\d{4})$/,
      );
      const matchWithoutIndex = firstPart.match(/^(\d{2}\/\d{2}\/\d{4})$/);

      if (matchWithIndex) {
        index = parseInt(matchWithIndex[1], 10);
        date = matchWithIndex[2];
      } else if (matchWithoutIndex) {
        date = matchWithoutIndex[1];
      }
      if (dest && Array.isArray(dest) && dest.length > 0) {
        const ref = await pdf.getPageIndex(dest[0]);
        if (typeof ref === 'number') {
          bookmarks.push({
            index,
            id,
            title: String(description).trim(),
            data: date,
            startPage: ref + 1, // 1-based
            endPage: 0, // placeholder, será calculado depois
          });
        }
      }
    }

    // calcular endPage
    const totalPages = pdf.numPages;
    for (let i = 0; i < bookmarks.length; i++) {
      if (i < bookmarks.length - 1) {
        bookmarks[i].endPage = bookmarks[i + 1].startPage - 1;
      } else {
        bookmarks[i].endPage = totalPages;
      }
    }

    return bookmarks;
  }
}
