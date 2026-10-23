// The steps of the flow, measured per session without personal data (docs/app.md, «Måling»):
// the event, the status of the assessment and the categories chosen. Never a registration number, a
// name or a date. The server (src/app/api/hendelse) checks every field against these lists.
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";

export const HENDELSER = ["landing", "sjekk_startet", "resultat_vist", "kjop_klikket", "betaling_fullfort", "brev_kopiert"] as const;
export type Hendelse = (typeof HENDELSER)[number];
// The verdict's tier (src/lib/app/vurdering.ts). «mulig» and «svak» are the levels before 2026-10-23,
// kept so older events still read.
export const STATUSER = ["sterk", "god", "kreverMer", "frist", "utenfor", "mulig", "svak"] as const;

const KJENTE = new Set(HOVEDKATEGORIER.flatMap((h) => [h.id, ...h.under.map((u) => `${h.id}.${u.id}`)]));

export type Maling = { okt: string; hendelse: Hendelse; status: (typeof STATUSER)[number] | null; kategorier: string[] | null };

// What the server stores, or null for anything outside the lists.
export function rensMaling(inn: unknown): Maling | null {
  const x = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  const hendelse = HENDELSER.find((h) => h === x.hendelse);
  if (!hendelse || typeof x.okt !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(x.okt)) return null;
  const status = x.status === undefined || x.status === null ? null : (STATUSER.find((s) => s === x.status) ?? undefined);
  if (status === undefined) return null;
  const kategorier = Array.isArray(x.kategorier) ? x.kategorier.slice(0, 30).filter((k): k is string => typeof k === "string" && KJENTE.has(k)) : null;
  return { okt: x.okt, hendelse, status, kategorier: kategorier?.length ? kategorier : null };
}

const OKT = "tvistr:okt";
function okt(): string | null {
  try {
    let id = sessionStorage.getItem(OKT);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(OKT, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Fire and forget: a failed measurement never stops the buyer.
export function maal(hendelse: Hendelse, ekstra: { status?: Maling["status"]; kategorier?: string[] } = {}) {
  const id = okt();
  if (!id) return;
  const kropp = JSON.stringify({ okt: id, hendelse, ...ekstra });
  try {
    if (navigator.sendBeacon?.(`/api/hendelse`, new Blob([kropp], { type: "application/json" }))) return;
    void fetch("/api/hendelse", { method: "POST", body: kropp, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {}
}
