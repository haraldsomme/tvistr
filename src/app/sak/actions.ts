"use server";

import { headers } from "next/headers";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { AvvistAvModellError } from "@/lib/ai/klient";
import { hentForhandler, tittel } from "@/lib/brreg";
import { byggBrev, forhandsvisning } from "@/lib/brev/brev";
import type { Brev, Brevsak } from "@/lib/brev/typer";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { GRUNNFILTER } from "@/lib/matching/grunnfilter";
import { type Niva, ranger } from "@/lib/matching/ranger";
import type { Kandidat } from "@/lib/matching/typer";
import { poengtekst } from "@/lib/matching/rett";
import { lagGrense } from "@/lib/rategrense";
import { byggSaken } from "@/lib/vedtaksvalg/kjoper";
import { hentProfil } from "@/lib/vipps/profil";
import { LOVSETNING, UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "@/lib/vedtaksvalg/valg";
import { vurderRiktighet } from "@/lib/brev/riktighet";
import { lovversjon } from "@/lib/brev/paragrafer";
import { idagOslo, rensBrevsvar, riktighetssak } from "./rens";
import { signer, sjekkSignatur } from "./signatur";

// The paragraph the letter cites its precedent with, and the decision it rests on.
export type Funn =
  | {
      ok: true;
      avsnitt: string;
      // Null when there was no candidate and the letter rests on the law (LOVSETNING).
      niva: Niva | null;
      vedtak: { saksnummer: string | null; vedtaksdato: string | null; kildeUrl: string; lovversjon: "før_2024" | "etter_2024" | "ukjent" } | null;
      antallKandidater: number;
      perNiva: Record<Niva, number>;
      // The server's signature on the paragraph, the level and the decision (signatur.ts).
      signatur: string;
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

// kjopsdato: the day the car was registered on its current owner. ar: the year it was first
// registered; the decisions' age is from the model year, so the user's age is an approximation.
export async function finnVedtak(inn: unknown): Promise<Funn> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const s = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  // The whole case is checked before the search, so a case the letter would stop costs no model call.
  const rens = rensBrevsvar(s);
  if (!rens.ok) return { ok: false, melding: rens.melding };
  const { valgte, rent, kjopsdato, km, ar, somDenEr, krav, forsok, detaljer } = rens.svar.vedtak;

  // «Vet ikke ennå» is compared on the symptom, like any other category.
  const { sak, kjoper } = byggSaken({
    kjopsdato,
    km,
    ar,
    somDenEr: somDenEr === "vet_ikke" ? null : somDenEr,
    krav,
    forsok,
    feil: valgte.map((h) => ({
      hoved: h.id,
      under: rent[h.id],
      oppdaget: detaljer[h.id].oppdaget,
      beskrivelse: detaljer[h.id].beskrivelse,
      opplysning: detaljer[h.id].opplysning,
      verksted: detaljer[h.id].verksted,
      rapport: detaljer[h.id].rapport,
    })),
  });

  try {
    const alle = await hentAlle();
    const { kandidater, perNiva } = ranger(alle, sak);
    if (!kandidater.length) {
      console.info("vedtaksvalg: ingen kandidat, lovsetning");
      return { ok: true, avsnitt: LOVSETNING, niva: null, vedtak: null, antallKandidater: 0, perNiva, signatur: signer({ avsnitt: LOVSETNING, niva: null, vedtak: null }) };
    }
    const detaljrader = await db
      .select({
        id: vedtak.id,
        kildeUrl: vedtak.kildeUrl,
        utvalg: UTVALG_I_TEKSTEN,
        merke: vedtak.merke,
        modell: vedtak.modell,
        arsmodell: vedtak.arsmodell,
        lovversjon: vedtak.lovversjonAvledet,
      })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const vedtakDetaljer = new Map<number, Vedtaksdetaljer>(detaljrader.map((d) => [d.id, { kildeUrl: d.kildeUrl, utvalg: d.utvalg, merke: d.merke, modell: d.modell, arsmodell: d.arsmodell }]));
    const lovversjoner = new Map(detaljrader.map((d) => [d.id, d.lovversjon ?? "ukjent"]));
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
    const funnet = {
      avsnitt: svar.avsnitt,
      niva: svar.niva,
      vedtak: { saksnummer: valgt.saksnummer, vedtaksdato: valgt.vedtaksdato, kildeUrl: vedtakDetaljer.get(valgt.id)!.kildeUrl, lovversjon: lovversjoner.get(valgt.id)! },
    };
    return { ok: true, ...funnet, antallKandidater: kandidater.length, perNiva, signatur: signer(funnet) };
  } catch (e) {
    console.error("vedtaksvalget feilet", e);
    if (e instanceof AvvistAvModellError) return { ok: false, melding: "Saken kunne ikke behandles automatisk. Prøv igjen, eller beskriv feilen på en annen måte." };
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}

export type BrevResultat = { ok: true; brev: Brev; fullt: boolean } | { ok: false; melding: string };

const forMangeBrev = lagGrense({ antall: 20, vinduMs: 60_000 });

// What finnVedtak gave the browser, taken back only with the server's signature on it, so the paragraph
// in the letter is the one the server wrote. undefined: not signed by this server.
function rensPraksis(f: unknown): Brevsak["praksis"] | undefined {
  const x = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
  if (x.ok !== true || !sjekkSignatur({ avsnitt: x.avsnitt, niva: x.niva, vedtak: x.vedtak }, x.signatur)) return undefined;
  const v = x.vedtak as { saksnummer: string | null; kildeUrl: string; lovversjon: "før_2024" | "etter_2024" | "ukjent" } | null;
  if (x.niva === null || !v) return null;
  return { avsnitt: x.avsnitt as string, kildeUrl: v.kildeUrl, saksnummer: v.saksnummer, lovversjon: v.lovversjon };
}

// The whole letter once the buyer has paid, otherwise the preview: the background and the paragraph
// citing the decision, the rest only as its length. The buyer is fetched here, never taken from the
// browser, and nothing is stored.
export async function byggBrevet(inn: unknown): Promise<BrevResultat> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMangeBrev(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const o = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  const rens = rensBrevsvar((o.svar && typeof o.svar === "object" ? o.svar : {}) as Record<string, unknown>);
  if (!rens.ok) return { ok: false, melding: rens.melding };
  const r = rens.svar;

  // The seller's name and address come from the register, not from the browser.
  const forslag = await hentForhandler(r.selgerOrgnr);
  if (!forslag) return { ok: false, melding: "Vi fikk ikke hentet selgeren fra Enhetsregisteret. Prøv igjen, eller velg selgeren på nytt." };

  const praksis = rensPraksis(o.funn);
  if (praksis === undefined) return { ok: false, melding: "Vi kunne ikke bekrefte vedtaket brevet viser til. Lag brevet på nytt." };

  const kjoper = await hentProfil(typeof o.ordreId === "string" ? o.ordreId.slice(0, 100) : null);
  const brev = byggBrev({
    dato: idagOslo(),
    kjoper,
    selger: { navn: tittel(forslag.navn), orgnr: forslag.orgnr, adresse: forslag.adresse },
    bil: r.bil,
    kjopsdato: r.kjopsdato,
    km: r.km,
    kjopesum: r.kjopesum,
    somDenEr: r.somDenEr,
    feil: r.feil,
    krav: r.krav,
    utlegg: r.utlegg,
    kontakt: r.kontakt,
    praksis,
  });

  // One line per letter for the operator, without personal data: which law, which time levels, which
  // decision, and which rules gave warnings, to see which rules are hit often and whether any is too strict.
  const riktighet = vurderRiktighet(riktighetssak(r, { orgnr: forslag.orgnr, status: forslag.status, naeringskode: forslag.naeringskode }));
  const regler = [...r.vedtak.tidslinje.advarsler, ...riktighet.advarsler].map((m) => m.regel);
  console.info(
    "brev",
    JSON.stringify({
      lovversjon: lovversjon(r.kjopsdato),
      tidsniva: r.vedtak.tidslinje.avledet.map((a) => a.tidsnivaa),
      niva: (o.funn as { niva?: unknown }).niva ?? null,
      vedtak: praksis?.saksnummer ?? null,
      advarsler: regler.length,
      regler,
      fullt: !!kjoper,
    }),
  );
  return { ok: true, brev: kjoper ? brev : forhandsvisning(brev), fullt: !!kjoper };
}
