import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// Use built-in Roboto fonts from pdfmake
import * as pdfFonts from "pdfmake/build/vfs_fonts";

// Assign virtual file system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fonts = pdfFonts as any;
if (fonts && fonts.pdfMake && fonts.pdfMake.vfs) {
  (pdfMake as any).vfs = fonts.pdfMake.vfs;
}

export function generatePdf(docDefinition: TDocumentDefinitions): void {
  pdfMake.createPdf(docDefinition).open();
}

export function downloadPdf(
  docDefinition: TDocumentDefinitions,
  filename: string
): void {
  pdfMake.createPdf(docDefinition).download(filename);
}
