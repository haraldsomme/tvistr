"use server";

import { headers } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { AvvistAvModellError } from "@/lib/ai/klient";
import { brukerNiva, HOVEDKATEGORIER, rensFeilvalg, rensTidsvalg, VISTE_SEG_VALG } from "@/lib/feil/kategorier";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { ranger, type Trinn } from "@/lib/matching/ranger";
import type { Brukersak, Kandidat, Krav } from "@/lib/matching/typer";
import { lagGrense } from "@/lib/rategrense";
import type { Bruk } from "@/lib/vedtaksvalg/instruks";
import { type Kjoper, type Vedtaksdetaljer, velgVedtak } from "@/lib/vedtaksvalg/valg";

// The paragraph the letter cites its precedent with, and the decision it rests on.
export type Funn =
  | {
      ok: true;
      avsnitt: string;
      bruk: Bruk;
      forbehold: string;
      vedtak: { saksnummer: string | null; vedtaksdato: string | null; kildeUrl: string };
      antallKandidater: number;
      perTrinn: Record<Trinn, number>;
    }
  | { ok: false; melding: string };

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });

// Decisions with medhold for a dealer sale of a car or van under the consumer purchase act, where the
// committee granted something. The registry lookup does not give the vehicle type, so both are taken.
const GRUNNFILTER = and(
  inArray(vedtak.utfall, ["medhold", "delvis_medhold"]),
  inArray(vedtak.kjoretoytype, ["personbil", "varebil"]),
  eq(vedtak.lov, "forbrukerkjøpsloven"),
  eq(vedtak.selgerType, "forhandler"),
  sql`cardinality(${vedtak.sanksjoner}) > 0`,
);

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
const KILDER = ["skriftlig", "muntlig", "nei"] as const;
const kildeAv = (v: unknown) => KILDER.find((k) => k === v) ?? null;
// «Ja, skriftlig» or «Ja, muntlig» is yes; anything else unknown.
const kilde = (v: unknown): boolean | null => (v === "skriftlig" || v === "muntlig" ? true : v === "nei" ? false : null);
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

  const ar = heltall(s.ar, 1950, 2100);
  const kjopsar = dato ? Number(dato.slice(0, 4)) : new Date().getFullYear();
  const detaljer = (s.detaljer && typeof s.detaljer === "object" ? s.detaljer : {}) as Record<string, Record<string, unknown> | undefined>;
  const forsok = heltall(s.forsok, 0, 3);
  const krav = KRAV.find((k) => k === s.krav) ?? null;
  const somDenEr = s.somDenEr === "ja" ? true : s.somDenEr === "nei" ? false : null;
  const sak: Brukersak = {
    // «Vet ikke ennå» is compared on the symptom, like any other category.
    kategorier: valgte.map((h) => ({
      hoved: h.id,
      under: rent[h.id],
      niva: brukerNiva(tider[h.id]!, dato),
      opplysning: kilde(detaljer[h.id]?.opplysning),
      verksted: kilde(detaljer[h.id]?.verksted),
    })),
    km: heltall(s.km, 1, 1_500_000),
    alder: ar === null ? null : Math.max(0, kjopsar - ar),
    somDenEr,
    krav,
    forsok,
  };
  const kjoper: Kjoper = {
    kjopsdato: dato,
    km: sak.km,
    alder: sak.alder,
    som_den_er: somDenEr === null ? "vet ikke" : somDenEr ? "ja" : "nei",
    krav,
    rettingsforsok: forsok,
    feil: valgte.map((h, i) => ({
      kategori: `${h.id} (${h.navn})`,
      underkategorier: rent[h.id].map((u) => `${h.id}.${u} (${h.under.find((x) => x.id === u)!.navn})`),
      beskrivelse: tekst(detaljer[h.id]?.beskrivelse, 200),
      viste_seg: VISTE_SEG_VALG.find((t) => t.id === tider[h.id])!.navn,
      tidsniva: sak.kategorier[i].niva,
      selger_sa_noe: kildeAv(detaljer[h.id]?.opplysning),
      verksted_undersokt: kildeAv(detaljer[h.id]?.verksted),
    })),
  };

  try {
    const alle = await hentAlle();
    const { kandidater, perTrinn } = ranger(alle, sak);
    if (!kandidater.length) return { ok: false, melding: "Fant ingen vedtak å sammenligne med." };
    const detaljrader = await db
      .select({
        id: vedtak.id,
        kildeUrl: vedtak.kildeUrl,
        merke: vedtak.merke,
        modell: vedtak.modell,
        arsmodell: vedtak.arsmodell,
        kjopesum: vedtak.kjopesumNok,
        prisavslagProsent: vedtak.prisavslagProsent,
        rettingsforsok: vedtak.rettingsforsok,
        enstemmig: vedtak.enstemmig,
        dissens: vedtak.dissens,
        sammendrag: vedtak.sammendrag,
        nokkelmomenter: vedtak.utvalgetsNokkelmomenter,
      })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const vedtakDetaljer = new Map<number, Vedtaksdetaljer>(detaljrader.map(({ id, ...d }) => [id, d]));
    const etterId = new Map(alle.map((k) => [k.id, k]));

    const svar = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer: vedtakDetaljer });
    const valgt = etterId.get(svar.valg.vedtak_id)!;
    console.info(`vedtaksvalg: ${valgt.saksnummer} (${svar.valg.bruk}), ${svar.forsok} forsøk, ${svar.forbruk.tokensInn} inn / ${svar.forbruk.tokensUt} ut, $${svar.forbruk.kostnadUsd.toFixed(3)}`);
    return {
      ok: true,
      avsnitt: svar.valg.avsnitt,
      bruk: svar.valg.bruk,
      forbehold: svar.valg.forbehold,
      vedtak: { saksnummer: valgt.saksnummer, vedtaksdato: valgt.vedtaksdato, kildeUrl: vedtakDetaljer.get(valgt.id)!.kildeUrl },
      antallKandidater: kandidater.length,
      perTrinn,
    };
  } catch (e) {
    console.error("vedtaksvalget feilet", e);
    if (e instanceof AvvistAvModellError) return { ok: false, melding: "Saken kunne ikke behandles automatisk. Prøv igjen, eller beskriv feilen på en annen måte." };
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
