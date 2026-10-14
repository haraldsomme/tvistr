"use server";

import { headers } from "next/headers";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { AvvistAvModellError } from "@/lib/ai/klient";
import { hentForhandler, tittel } from "@/lib/brreg";
import { byggBrev, forhandsvisning } from "@/lib/brev/brev";
import type { Brev, Brevsak } from "@/lib/brev/typer";
import { type Niva, ranger } from "@/lib/matching/ranger";
import { poengtekst } from "@/lib/matching/rett";
import { lagGrense } from "@/lib/rategrense";
import { byggSaken } from "@/lib/vedtaksvalg/kjoper";
import { HELT_BREV_UTEN_BETALING, hentProfil } from "@/lib/vipps/profil";
import { LOVSETNING, UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "@/lib/vedtaksvalg/valg";
import { vurderRiktighet } from "@/lib/brev/riktighet";
import { lovversjon } from "@/lib/brev/paragrafer";
import { idagOslo, rensBrevsvar, riktighetssak } from "./rens";
import { apne, forsegle } from "./signatur";
import { hentAlle } from "./vedtak-db";

// The decision the letter cites, as the browser may see it before payment: the level, the case number
// and the date (public), never the paragraph's quotes or the link. The paragraph itself travels sealed
// (signatur.ts) and is opened only by byggBrevet.
export type Funn =
  | {
      ok: true;
      // Null when there was no candidate and the letter rests on the law (LOVSETNING).
      niva: Niva | null;
      vedtak: { saksnummer: string | null; vedtaksdato: string | null } | null;
      antallKandidater: number;
      perNiva: Record<Niva, number>;
      forseglet: string;
    }
  | { ok: false; melding: string };

// What is sealed: the paragraph, the level and the decision with its link.
type Forseglet = { avsnitt: string; niva: Niva | null; vedtak: { saksnummer: string | null; vedtaksdato: string | null; kildeUrl: string; lovversjon: "før_2024" | "etter_2024" | "ukjent" } | null };
const tilNettleseren = (f: Forseglet, rest: { antallKandidater: number; perNiva: Record<Niva, number> }): Funn => ({
  ok: true,
  niva: f.niva,
  vedtak: f.vedtak && { saksnummer: f.vedtak.saksnummer, vedtaksdato: f.vedtak.vedtaksdato },
  ...rest,
  forseglet: forsegle(f),
});

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });

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
      return tilNettleseren({ avsnitt: LOVSETNING, niva: null, vedtak: null }, { antallKandidater: 0, perNiva });
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
    return tilNettleseren(
      { avsnitt: svar.avsnitt, niva: svar.niva, vedtak: { saksnummer: valgt.saksnummer, vedtaksdato: valgt.vedtaksdato, kildeUrl: vedtakDetaljer.get(valgt.id)!.kildeUrl, lovversjon: lovversjoner.get(valgt.id)! } },
      { antallKandidater: kandidater.length, perNiva },
    );
  } catch (e) {
    console.error("vedtaksvalget feilet", e);
    if (e instanceof AvvistAvModellError) return { ok: false, melding: "Saken kunne ikke behandles automatisk. Prøv igjen, eller beskriv feilen på en annen måte." };
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}

// `betalingIUtvikling`: development only (TVISTR_HELT_BREV_UTEN_BETALING=1), the pay button simulates a
// payment until Vipps is connected.
export type BrevResultat = { ok: true; brev: Brev; fullt: boolean; betalingIUtvikling: boolean } | { ok: false; melding: string };

const forMangeBrev = lagGrense({ antall: 20, vinduMs: 60_000 });

// What finnVedtak gave the browser, taken back only when this server sealed it, so the paragraph in
// the letter is the one the server wrote. undefined: not sealed by this server.
function rensPraksis(f: unknown): Brevsak["praksis"] | undefined {
  const x = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
  const p = x.ok === true ? (apne(x.forseglet) as Forseglet | undefined) : undefined;
  if (!p || typeof p.avsnitt !== "string") return undefined;
  if (p.niva === null || !p.vedtak) return null;
  return { avsnitt: p.avsnitt, kildeUrl: p.vedtak.kildeUrl, saksnummer: p.vedtak.saksnummer, lovversjon: p.vedtak.lovversjon };
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
      niva: (o.funn as { niva?: unknown } | undefined)?.niva ?? null,
      vedtak: praksis?.saksnummer ?? null,
      advarsler: regler.length,
      regler,
      fullt: !!kjoper,
    }),
  );
  return { ok: true, brev: kjoper ? brev : forhandsvisning(brev), fullt: !!kjoper, betalingIUtvikling: HELT_BREV_UTEN_BETALING() };
}
