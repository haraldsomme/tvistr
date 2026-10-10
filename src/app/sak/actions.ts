"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { lagHentAnalyse, lagHentFulltekst } from "@/lib/praksis/fulltekst";
import { type Avsnitt, skrivPraksisdel } from "@/lib/praksis/praksisdel";
import { sammenlign, type Skjema } from "@/lib/sammenligning";
import { lagHentEksempler, lagHentKandidater } from "@/lib/sammenligning/kandidater";
import type { FeilResultat } from "@/lib/sammenligning/typer";
import { lagGrense } from "@/lib/rategrense";
import { type Valideringsfeil, validerSkjema } from "@/lib/skjema/skjema";

const idagINorge = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });

// The buyer's form (/sak): validated again on the server. Back comes the assessment per defect,
// deterministic and at once; the practice paragraph is written on request (src/lib/praksis).
export type FeilSvar = Pick<FeilResultat, "feil_id" | "kategori_pass2" | "styrke" | "styrke_grunn" | "ingen_spor_arsak" | "forlik" | "reklamasjon_over_to_mnd" | "tapte"> & {
  // The best approved decision, and how many more there are.
  vedtak: { saksnummer: string; vedtaksdato: string; kilde_url: string } | null;
  flere_vedtak: number;
  til_brevet: boolean;
};
export type SakSvar = { ok: true; stopp: string | null; feil: FeilSvar[]; valgt_til_brev: string[] } | { ok: false; feil: Valideringsfeil[] } | { ok: false; melding: string };

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
      feil: r.feil.map((f) => {
        const v = f.kandidater[0];
        return {
          feil_id: f.feil_id,
          kategori_pass2: f.kategori_pass2,
          styrke: f.styrke,
          styrke_grunn: f.styrke_grunn,
          ingen_spor_arsak: f.ingen_spor_arsak,
          forlik: f.forlik,
          reklamasjon_over_to_mnd: f.reklamasjon_over_to_mnd,
          tapte: f.tapte,
          vedtak: v ? { saksnummer: v.saksnummer, vedtaksdato: v.vedtaksdato, kilde_url: v.kilde_url } : null,
          flere_vedtak: Math.max(0, f.kandidater.length - 1),
          til_brevet: r.valgt_til_brev.includes(f.feil_id),
        };
      }),
    };
  } catch (e) {
    console.error("sendSak", e);
    return { ok: false, melding: "Noe gikk galt hos oss. Svarene dine er ikke borte; prøv igjen om litt." };
  }
}

// The letter's practice section, on request: the filter runs again on the server (the candidates are
// never taken from the browser), then the model writes and the verifier checks (docs/praksis.md).
export type PraksisUt = { ok: true; avsnitt: Avsnitt[]; lovendring: string | null } | { ok: false; melding: string };

const forMangePraksis = lagGrense({ antall: 3, vinduMs: 60_000 });

export async function skrivPraksisFor(skjema: Skjema): Promise<PraksisUt> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMangePraksis(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const idag = idagINorge();
  if (validerSkjema(skjema, idag).length) return { ok: false, melding: "Skjemaet har feil. Rett dem og send på nytt." };
  try {
    const d = await skrivPraksisdel(skjema, idag, { hentKandidater: lagHentKandidater(db), hentFulltekst: lagHentFulltekst(db), hentAnalyse: lagHentAnalyse(db), hentEksempler: lagHentEksempler(db),
      // The jurist's blocks before approval, only where PRAKSIS_UTKAST=1 is set (local testing).
      utkast: process.env.PRAKSIS_UTKAST === "1",
    });
    for (const p of d.forsok)
      console.log(JSON.stringify({ praksis: p.versjon, modus: p.modus, feil_id: p.feil_id, vedtak_id: p.vedtak_id, grunn: p.grunn, strykninger: p.strykninger.length, usd: p.forbruk?.kostnadUsd ?? 0 }));
    return { ok: true, avsnitt: d.avsnitt, lovendring: d.lovendring };
  } catch (e) {
    console.error("skrivPraksisFor", e);
    return { ok: false, melding: "Noe gikk galt da vi skrev avsnittet. Prøv igjen om litt." };
  }
}
