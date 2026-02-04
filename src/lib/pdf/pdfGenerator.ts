import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// Use built-in Roboto fonts from pdfmake
import * as pdfFonts from "pdfmake/build/vfs_fonts";

// Assign virtual file system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fonts = pdfFonts as any;
if (fonts && fonts.pdfMake && fonts.pdfMake.vfs) {
  (pdfMake as any).vfs = fonts.pdfMake.vfs;
}

export async function downloadPdf(
  docDefinition: TDocumentDefinitions,
  filename: string
): Promise<void> {
  const buffer = await pdfMake.createPdf(docDefinition).getBuffer();

  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!filePath) return; // User cancelled

  await writeFile(filePath, buffer);
}
