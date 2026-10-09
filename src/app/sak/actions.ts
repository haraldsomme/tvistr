"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { sammenlign } from "@/lib/sammenligning";
import { lagHentKandidater } from "@/lib/sammenligning/kandidater";
import type { FeilResultat, Naermeste, Spor } from "@/lib/sammenligning/typer";
import { lagGrense } from "@/lib/rategrense";
import { type Skjema, type Valideringsfeil, validerSkjema } from "@/lib/skjema/skjema";
import { idagINorge } from "@/lib/skjema/utkast";

// What the page shows per defect. The practice paragraph itself is the letter's and is not sent.
export type FeilSvar = {
  feil_id: string;
  spor: Spor | null;
  ingen_spor_arsak: string | null;
  vedtak: { saksnummer: string; vedtaksdato: string; kilde_url: string; sanksjon: string | null; tilkjent_totalt_nok: number | null } | null;
  til_brevet: boolean;
  styrke: FeilResultat["styrke"];
  motstridende: FeilResultat["motstridende"];
  forlik: boolean;
  // Only when no decision passed: the nearest won one and what the buyer lacks against it.
  naermeste: Naermeste | null;
};
export type SakSvar = { ok: true; stopp: string | null; feil: FeilSvar[] } | { ok: false; feil: Valideringsfeil[] } | { ok: false; melding: string };

const forMange = lagGrense({ antall: 10, vinduMs: 60_000 });

// A Server Action is a public POST endpoint, so the form is validated again here.
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
      feil: r.feil.map((f) => ({
        feil_id: f.feil_id,
        spor: f.kandidat_spor ?? f.spor_primar,
        ingen_spor_arsak: f.ingen_spor_arsak,
        vedtak: f.kandidat && {
          saksnummer: f.kandidat.saksnummer,
          vedtaksdato: f.kandidat.vedtaksdato,
          kilde_url: f.kandidat.kilde_url,
          sanksjon: f.kandidat.sanksjon,
          tilkjent_totalt_nok: f.kandidat.tilkjent_totalt_nok,
        },
        til_brevet: r.valgt_til_brev.includes(f.feil_id),
        styrke: f.styrke,
        motstridende: f.motstridende,
        forlik: f.forlik,
        naermeste: f.naermeste,
      })),
    };
  } catch (e) {
    console.error("sendSak", e);
    return { ok: false, melding: "Noe gikk galt hos oss. Svarene dine er ikke borte; prøv igjen om litt." };
  }
}
