"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { sammenlign, type Skjema } from "@/lib/sammenligning";
import { lagHentKandidater } from "@/lib/sammenligning/kandidater";
import type { FeilResultat, Motstridende } from "@/lib/sammenligning/typer";
import { lagGrense } from "@/lib/rategrense";
import { type Valideringsfeil, validerSkjema } from "@/lib/skjema/skjema";

const idagINorge = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });

// The buyer's form (/sak): validated again on the server. Back come the assessment per defect and
// the letter's practice section (the paragraphs, their order and the amendment sentence), which the
// page shows under the form while the letter is built there (2026-10-10).
export type FeilSvar = Pick<FeilResultat, "feil_id" | "kategori_pass2" | "styrke" | "praksis" | "ingen_spor_arsak" | "forlik" | "kategori_tilbakefall" | "avsnitt"> & {
  vedtak: { saksnummer: string; vedtaksdato: string; kilde_url: string } | null;
  motstridende: Pick<Motstridende, "saksnummer" | "vedtaksdato" | "kilde_url" | "skilte"> | null;
  til_brevet: boolean;
};
export type SakSvar =
  | { ok: true; stopp: string | null; feil: FeilSvar[]; valgt_til_brev: string[]; lovendring: string | null }
  | { ok: false; feil: Valideringsfeil[] }
  | { ok: false; melding: string };

const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

export async function sendSak(skjema: Skjema): Promise<SakSvar> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const feil = validerSkjema(skjema, idagINorge());
  if (feil.length) return { ok: false, feil };
  try {
    const r = await sammenlign(skjema, lagHentKandidater(db), idagINorge());
    return {
      ok: true,
      stopp: r.stopp,
      valgt_til_brev: r.valgt_til_brev,
      lovendring: r.lovendring,
      feil: r.feil.map((f) => ({
        feil_id: f.feil_id,
        kategori_pass2: f.kategori_pass2,
        styrke: f.styrke,
        praksis: f.praksis,
        ingen_spor_arsak: f.ingen_spor_arsak,
        forlik: f.forlik,
        kategori_tilbakefall: f.kategori_tilbakefall,
        avsnitt: f.avsnitt,
        vedtak: f.kandidat && { saksnummer: f.kandidat.saksnummer, vedtaksdato: f.kandidat.vedtaksdato, kilde_url: f.kandidat.kilde_url },
        motstridende: f.motstridende && { saksnummer: f.motstridende.saksnummer, vedtaksdato: f.motstridende.vedtaksdato, kilde_url: f.motstridende.kilde_url, skilte: f.motstridende.skilte },
        til_brevet: r.valgt_til_brev.includes(f.feil_id),
      })),
    };
  } catch (e) {
    console.error("sendSak", e);
    return { ok: false, melding: "Noe gikk galt hos oss. Svarene dine er ikke borte; prøv igjen om litt." };
  }
}
