import { kildedokument, kildesak, vedtak, vedtakAnalyse, vedtakFeil } from "../src/db/schema";

// Order matters for restore: referenced tables first. `brevsak` is left out on purpose: it holds
// users' personal data, which must not end up in backup files.
export const TABELLER = { kildedokument, kildesak, vedtak, vedtakAnalyse, vedtakFeil } as const;

export type Sikkerhetskopi = {
  format: 1;
  tidspunkt: string;
  migreringer: string[];
  tabeller: Partial<Record<keyof typeof TABELLER, { antall: number; sjekksum: string; rader: Record<string, unknown>[] }>>;
};
