import { ALLE } from "@/lib/vurdering/statistikk";

// The number of decisions the pages name. Without a database at build time the page is built without
// the number, not stopped.
export async function antallVedtak(): Promise<number | null> {
  try {
    const { lesStatistikk } = await import("@/lib/vurdering/statistikk-db");
    return (await lesStatistikk()).get(ALLE)?.antallSaker ?? null;
  } catch (e) {
    console.error("antall vedtak ble ikke lest", e);
    return null;
  }
}
