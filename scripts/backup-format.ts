import { kildedokument, kildesak, vedtak } from "../src/db/schema";

// Order matters for restore: referenced tables first.
export const TABELLER = { kildedokument, kildesak, vedtak } as const;

export type Sikkerhetskopi = {
  format: 1;
  tidspunkt: string;
  migreringer: string[];
  tabeller: Partial<Record<keyof typeof TABELLER, { antall: number; sjekksum: string; rader: Record<string, unknown>[] }>>;
};
