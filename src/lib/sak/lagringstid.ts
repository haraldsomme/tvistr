// How long a case is kept, as the privacy statement and the terms say. The deletion is sletting.ts.
export const LAGRES_AR = 3;
export const UFULLFORT_DAGER = 30;

// A paid case older than `betalt`, or an unpaid one older than `ufullfort`, is deleted.
export function grenser(na: Date): { betalt: Date; ufullfort: Date } {
  const betalt = new Date(na);
  betalt.setUTCFullYear(betalt.getUTCFullYear() - LAGRES_AR);
  return { betalt, ufullfort: new Date(na.getTime() - UFULLFORT_DAGER * 86_400_000) };
}
