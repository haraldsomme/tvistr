"use server";

import { headers } from "next/headers";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { AvvistAvModellError } from "@/lib/ai/klient";
import { HOVEDKATEGORIER, rensFeilvalg, rensTidsvalg } from "@/lib/feil/kategorier";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { GRUNNFILTER } from "@/lib/matching/grunnfilter";
import { type Niva, ranger } from "@/lib/matching/ranger";
import type { Kandidat, Krav } from "@/lib/matching/typer";
import { poengtekst } from "@/lib/matching/rett";
import { lagGrense } from "@/lib/rategrense";
import { byggSaken, type Kilde } from "@/lib/vedtaksvalg/kjoper";
import { LOVSETNING, UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "@/lib/vedtaksvalg/valg";

// The paragraph the letter cites its precedent with, and the decision it rests on.
export type Funn =
  | {
      ok: true;
      avsnitt: string;
      // Null when there was no candidate and the letter rests on the law (LOVSETNING).
      niva: Niva | null;
      vedtak: { saksnummer: string | null; vedtaksdato: string | null; kildeUrl: string } | null;
      antallKandidater: number;
      perNiva: Record<Niva, number>;
    }
  | { ok: false; melding: string };

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });

// Steps 3 and 5 reach across categories, so every decision is ranked. The set only changes on
// import, so it is read once per server instance.
let alleVedtak: Promise<Kandidat[]> | null = null;
function hentAlle(): Promise<Kandidat[]> {
  alleVedtak ??= db
    .select({
      id: vedtak.id,
      saksnummer: vedtak.saksnummer,
      vedtaksdato: vedtak.vedtaksdato,
      km: vedtak.kmVedKjop,
      alder: vedtak.alderVedKjop,
      somDenEr: vedtak.somDenEr,
      sanksjoner: vedtak.sanksjoner,
      mangelsgrunnlag: vedtak.mangelsgrunnlag,
      paragrafer: vedtak.paragrafer,
      tvistetema: vedtak.tvistetema,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
      avgjorende: vedtak.avgjorende,
    })
    .from(vedtak)
    .where(GRUNNFILTER)
    .catch((e) => {
      alleVedtak = null;
      throw e;
    });
  return alleVedtak;
}

const gyldigDato = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const heltall = (v: unknown, min: number, maks: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks ? v : null);
const KRAV: readonly Krav[] = ["retting", "prisavslag", "heving"];
const KILDER: readonly Kilde[] = ["skriftlig", "muntlig", "nei"];
const kildeAv = (v: unknown) => KILDER.find((k) => k === v) ?? null;
const tekst = (v: unknown, maks: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, maks) : null);

// kjopsdato: the day the car was registered on its current owner. ar: the year it was first
// registered; the decisions' age is from the model year, so the user's age is an approximation.
export async function finnVedtak(inn: unknown): Promise<Funn> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const s = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  const rent = rensFeilvalg(s.valg);
  const valgte = HOVEDKATEGORIER.filter((h) => h.id in rent);
  if (!valgte.length) return { ok: false, melding: "Velg minst én feil." };
  const tider = rensTidsvalg(s.tid);
  if (valgte.some((h) => !tider[h.id])) return { ok: false, melding: "Velg når hver feil viste seg." };
  const dato = gyldigDato(s.kjopsdato);
  const femArSiden = new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().slice(0, 10);
  if (dato && dato < femArSiden)
    return { ok: false, melding: "Det er mer enn fem år siden kjøpet. Da er fristen for å reklamere ute (forbrukerkjøpsloven § 27)." };

  const detaljer = (s.detaljer && typeof s.detaljer === "object" ? s.detaljer : {}) as Record<string, Record<string, unknown> | undefined>;
  // «Vet ikke ennå» is compared on the symptom, like any other category.
  const { sak, kjoper } = byggSaken({
    kjopsdato: dato,
    km: heltall(s.km, 1, 1_500_000),
    ar: heltall(s.ar, 1950, 2100),
    somDenEr: s.somDenEr === "ja" || s.somDenEr === "nei" ? s.somDenEr : null,
    krav: KRAV.find((k) => k === s.krav) ?? null,
    forsok: heltall(s.forsok, 0, 3),
    feil: valgte.map((h) => ({
      hoved: h.id,
      under: rent[h.id],
      tid: tider[h.id]!,
      beskrivelse: tekst(detaljer[h.id]?.beskrivelse, 200),
      opplysning: kildeAv(detaljer[h.id]?.opplysning),
      verksted: kildeAv(detaljer[h.id]?.verksted),
    })),
  });

  try {
    const alle = await hentAlle();
    const { kandidater, perNiva } = ranger(alle, sak);
    if (!kandidater.length) {
      console.info("vedtaksvalg: ingen kandidat, lovsetning");
      return { ok: true, avsnitt: LOVSETNING, niva: null, vedtak: null, antallKandidater: 0, perNiva };
    }
    const detaljrader = await db
      .select({
        id: vedtak.id,
        kildeUrl: vedtak.kildeUrl,
        utvalg: UTVALG_I_TEKSTEN,
        merke: vedtak.merke,
        modell: vedtak.modell,
        arsmodell: vedtak.arsmodell,
      })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const vedtakDetaljer = new Map<number, Vedtaksdetaljer>(detaljrader.map(({ id, ...d }) => [id, d]));
    const etterId = new Map(alle.map((k) => [k.id, k]));

    const svar = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer: vedtakDetaljer });
    const valgt = etterId.get(svar.r.id)!;
    const sanksjoner = (svar.r.feil && valgt.avgjorende?.feil.find((a) => a.id === svar.r.feil!.id)?.sanksjoner) || [];
    // What the paragraph was built from, for the server log only.
    const kontroll = {
      alder: valgt.alder,
      km: valgt.km,
      somDenEr: valgt.somDenEr,
      sanksjoner,
      sitater: svar.sitater,
      rettsligePoeng: svar.r.rett.map(poengtekst),
      modellValgte: svar.fulgt,
    };
    console.info(
      `vedtaksvalg: ${valgt.saksnummer} (nivå ${svar.niva}${svar.fulgt ? "" : ", rangeringens førstevalg"}), ${svar.forbruk.tokensInn} inn / ${svar.forbruk.tokensUt} ut, $${svar.forbruk.kostnadUsd.toFixed(3)}`,
      kontroll,
    );
    return {
      ok: true,
      avsnitt: svar.avsnitt,
      niva: svar.niva,
      vedtak: { saksnummer: valgt.saksnummer, vedtaksdato: valgt.vedtaksdato, kildeUrl: vedtakDetaljer.get(valgt.id)!.kildeUrl },
      antallKandidater: kandidater.length,
      perNiva,
    };
  } catch (e) {
    console.error("vedtaksvalget feilet", e);
    if (e instanceof AvvistAvModellError) return { ok: false, melding: "Saken kunne ikke behandles automatisk. Prøv igjen, eller beskriv feilen på en annen måte." };
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
