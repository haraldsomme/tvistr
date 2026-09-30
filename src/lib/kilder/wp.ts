// Decisions after May 2025 are listed on forbrukertilsynet.no through an embedded app that
// reads a JSON index from Azure Blob Storage and serves PDFs from a small API.

export const INDEKS_URL = "https://vedtaktilwebst.blob.core.windows.net/vedtak/vedtak.json";
const PDF_API_URL = "https://vedtak-api.forbrukertilsynet.no/api/pdf/";

export const BIL_KATEGORI = "Kjøretøy";

export type WpVedtak = {
  task_id: string;
  dato: string;
  kategori: string;
  pdf_filnavn: string;
};

export function parseIndeks(json: string): WpVedtak[] {
  const data = JSON.parse(json.replace(/^﻿/, "")) as { vedtak: WpVedtak[] };
  return data.vedtak;
}

export function pdfUrl(pdfFilnavn: string): string {
  return PDF_API_URL + encodeURIComponent(pdfFilnavn);
}
