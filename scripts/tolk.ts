// Interprets used-vehicle decisions into `vedtak`: model extraction → code redaction →
// model control pass for leftover personal data → normalisation → plausibility checks.
// Resumable: documents with status 'klassifisert' and er_bruktbil are processed; with
// --på-nytt also already interpreted ones (e.g. after a prompt change).
//
//   npm run tolk -- [--grense N] [--spredt] [--på-nytt] [--samtidig 6] [--id 12,34]

import { parseArgs } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { kildedokument, vedtak, type NyttVedtak } from "../src/db/schema";
import { AvvistAvModellError, erKontofeil, kallVerktoy, type Forbruk } from "../src/lib/ai/klient";
import { KONTROLL_SYSTEM, TOLKNING_SYSTEM, TOLKNING_VERSJON, tolkningBruker } from "../src/lib/ai/prompter";
import { fraModell, KONTROLL_SKJEMA, SITATFELT, TOLKNING_SKJEMA, type Tolkning } from "../src/lib/ai/skjema";
import { normaliserFirmanavn, normaliserMerke, normaliserOrgnr, normaliserParagrafer } from "../src/lib/normalisering";
import { kjorParallelt } from "../src/lib/parallell";
import { gjenstaende, rens, rensValgfri, type Identifikatorer } from "../src/lib/personvern/rens";
import { lesPdfTekst } from "../src/lib/tekst/pdf";
import { kontroller, maaKontrolleres, MERKNAD } from "../src/lib/validering";

const { values: args } = parseArgs({
  options: {
    grense: { type: "string" },
    spredt: { type: "boolean", default: false },
    "på-nytt": { type: "boolean", default: false },
    samtidig: { type: "string", default: "6" },
    // kildedokument ids; implies --på-nytt for those documents
    id: { type: "string" },
  },
});

type Funn = { funn: { tekst: string; type: string }[] };

function leggSammen(a: Forbruk, b: Forbruk): Forbruk {
  return { tokensInn: a.tokensInn + b.tokensInn, tokensUt: a.tokensUt + b.tokensUt, kostnadUsd: a.kostnadUsd + b.kostnadUsd };
}

async function tolkDokument(dok: { id: number; lokalSti: string; kildeUrl: string; saksnummer: string | null; kildeArkiv: string }) {
  const start = Date.now();
  const { tekst } = await lesPdfTekst(dok.lokalSti);

  const svar = await kallVerktoy<Tolkning>({
    system: TOLKNING_SYSTEM,
    verktoy: { name: "registrer_vedtak", description: "Registrer de strukturerte opplysningene fra vedtaket.", input_schema: TOLKNING_SKJEMA },
    bruker: tolkningBruker(tekst, { saksnummer: dok.saksnummer, arkiv: dok.kildeArkiv }),
    effort: "medium",
    maksTokens: 16000,
    strict: false,
  });
  let forbruk = svar.forbruk;
  const t = fraModell(svar.input);

  // Redaction, first pass: identifiers from the model plus fixed patterns.
  const id: Identifikatorer = {
    klager: t.personopplysninger.klager,
    personer: t.personopplysninger.personer,
    adresser: t.personopplysninger.adresser,
    andre: t.personopplysninger.andre,
  };
  const selgerErFirma = t.selger_type !== "privat" && !!t.selger_navn;
  let fulltekst = rens(tekst, id, { selgerErFirma });

  // Second pass: an independent model call looks for anything left in the redacted text.
  const kontroll = await kallVerktoy<Funn>({
    system: KONTROLL_SYSTEM,
    verktoy: { name: "rapporter_personopplysninger", description: "Rapporter gjenværende personopplysninger.", input_schema: KONTROLL_SKJEMA },
    bruker: `<tekst>\n${fulltekst}\n</tekst>`,
    effort: "low",
    maksTokens: 4000,
  });
  forbruk = leggSammen(forbruk, kontroll.forbruk);
  const funnliste = kontroll.input.funn.filter((f) => f.tekst.trim().length >= 2 && !/^\[[A-ZÆØÅ-]+\]$/.test(f.tekst.trim()));
  const funn = funnliste.map((f) => f.tekst);
  if (funn.length) {
    id.andre = [...id.andre, ...funn];
    fulltekst = rens(fulltekst, id, { selgerErFirma });
  }

  const r = (s: string | null) => rensValgfri(s, id);
  const sitater = Object.fromEntries(SITATFELT.map((f) => [f, r(t.sitater[f])])) as Tolkning["sitater"];
  const renset: Tolkning = {
    ...t,
    sitater,
    sammendrag: rens(t.sammendrag, id),
    forbehold_tekst: r(t.forbehold_tekst),
    feil_beskrivelse: r(t.feil_beskrivelse),
    bevis_vektlagt: r(t.bevis_vektlagt),
    tolkningsmerknad: r(t.tolkningsmerknad),
    utvalgets_nokkelmomenter: t.utvalgets_nokkelmomenter.map((m) => rens(m, id)),
  };

  const k = kontroller(renset, fulltekst);
  const arsaker = [...k.arsaker];
  if (funn.length) {
    // Everything found is removed; only a missed name says the first pass failed and needs review.
    const typer = [...new Set(funnliste.map((f) => f.type))].join(", ");
    const tekst = `kontrollkallet fant ${funn.length} gjenværende personopplysning(er) (${typer}), fjernet`;
    arsaker.push(funnliste.some((f) => f.type === "personnavn") ? tekst : `${MERKNAD}${tekst}`);
  }
  const rester = gjenstaende(fulltekst, id);
  if (rester.length) arsaker.push(`${rester.length} personopplysning(er) står fortsatt i fulltekst`);

  // A seller name that turned into a placeholder was a person, not a company.
  const selgerNavn = renset.selger_type === "privat" ? null : r(t.selger_navn);
  const selgerNavnOk = selgerNavn && !/\[[A-ZÆØÅ-]+\]/.test(selgerNavn) ? selgerNavn : null;
  const verksted = r(t.verksted_navn);

  const rad: NyttVedtak = {
    kildedokumentId: dok.id,
    saksnummer: dok.saksnummer,
    vedtaksdato: t.vedtaksdato,
    kildeUrl: dok.kildeUrl,
    selgerType: t.selger_type,
    selgerNavn: selgerNavnOk,
    selgerNavnNorm: normaliserFirmanavn(selgerNavnOk),
    selgerOrgnr: normaliserOrgnr(t.selger_orgnr),
    verkstedNavn: verksted && !/\[[A-ZÆØÅ-]+\]/.test(verksted) ? verksted : null,
    klagerErForbruker: t.klager_er_forbruker,
    kjoretoytype: t.kjoretoytype,
    merke: normaliserMerke(t.merke),
    modell: t.modell,
    arsmodell: t.arsmodell,
    drivstoff: t.drivstoff,
    kmVedKjop: t.km_ved_kjop,
    kjopesumNok: t.kjopesum_nok,
    alderVedKjop: k.alderVedKjop,
    bruktimport: t.bruktimport,
    kjopsdato: t.kjopsdato,
    overtakelsesdato: t.overtakelsesdato,
    forsteReklamasjonDato: t.forste_reklamasjon_dato,
    dagerTilReklamasjon: k.dagerTilReklamasjon,
    forbehold: t.forbehold,
    forbeholdTekst: renset.forbehold_tekst,
    feiltyper: t.feiltyper,
    feilBeskrivelse: renset.feil_beskrivelse,
    utbedringskostnadNok: t.utbedringskostnad_nok,
    bevistyper: t.bevistyper,
    bevisVektlagt: renset.bevis_vektlagt,
    kravtyper: t.kravtyper,
    prinsipaltKrav: t.prinsipalt_krav,
    mangelsgrunnlag: t.mangelsgrunnlag,
    tvistetema: t.tvistetema,
    krevdPrisavslagNok: t.krevd_prisavslag_nok,
    krevdErstatningNok: t.krevd_erstatning_nok,
    krevdTotaltNok: t.krevd_totalt_nok,
    utfall: t.utfall,
    tilkjentPrisavslagNok: t.tilkjent_prisavslag_nok,
    tilkjentErstatningNok: t.tilkjent_erstatning_nok,
    tilkjentTotaltNok: t.tilkjent_totalt_nok,
    gebyrTilkjent: t.gebyr_tilkjent,
    enstemmig: t.enstemmig,
    dissens: t.dissens,
    lov: t.lov,
    lovversjon: t.lovversjon,
    paragrafer: normaliserParagrafer(t.paragrafer, t.lov),
    sammendrag: renset.sammendrag,
    utvalgetsNokkelmomenter: renset.utvalgets_nokkelmomenter,
    fulltekstRenset: fulltekst,
    sitater: Object.fromEntries(Object.entries(sitater).filter(([, v]) => v != null)) as Record<string, string>,
    konfidens: t.konfidens,
    trengerKontroll: maaKontrolleres(arsaker),
    kontrollArsaker: arsaker.length ? arsaker : null,
    aiModell: svar.modell,
    promptVersjon: TOLKNING_VERSJON,
    tolketTidspunkt: new Date(),
    tokensInn: forbruk.tokensInn,
    tokensUt: forbruk.tokensUt,
    kostnadUsd: forbruk.kostnadUsd,
    varighetMs: Date.now() - start,
  };

  await db.insert(vedtak).values(rad).onConflictDoUpdate({ target: vedtak.kildedokumentId, set: { ...rad, kildedokumentId: undefined } });
  await db.update(kildedokument).set({ status: "tolket", feilmelding: null }).where(eq(kildedokument.id, dok.id));
  return { kostnad: forbruk.kostnadUsd, flagget: maaKontrolleres(arsaker) };
}

async function main() {
  const ider = args.id?.split(",").map(Number).filter(Number.isInteger);
  const statuser = args["på-nytt"] || ider ? (["klassifisert", "tolket"] as const) : (["klassifisert"] as const);
  const grense = args.grense ? Number(args.grense) : 1_000_000;
  const dokumenter = await db
    .select({ id: kildedokument.id, lokalSti: kildedokument.lokalSti, kildeUrl: kildedokument.kildeUrl, saksnummer: kildedokument.saksnummer, kildeArkiv: kildedokument.kildeArkiv })
    .from(kildedokument)
    .where(
      and(
        eq(kildedokument.erBruktbil, true),
        inArray(kildedokument.status, [...statuser]),
        ider?.length ? inArray(kildedokument.id, ider) : undefined,
      ),
    )
    .orderBy(
      ...(args.spredt
        ? [sql`row_number() over (partition by ${kildedokument.ar} order by md5(${kildedokument.id}::text))`, kildedokument.ar]
        : [kildedokument.id]),
    )
    .limit(grense);

  console.log(`Tolker ${dokumenter.length} vedtak (${TOLKNING_VERSJON}).`);
  let ferdig = 0;
  let feil = 0;
  let flagget = 0;
  let kostnad = 0;
  await kjorParallelt(dokumenter, Number(args.samtidig), async (dok) => {
    try {
      const r = await tolkDokument({ ...dok, lokalSti: dok.lokalSti! });
      kostnad += r.kostnad;
      if (r.flagget) flagget++;
    } catch (e) {
      if (erKontofeil(e)) throw e;
      feil++;
      if (process.env.TOLK_DEBUG) console.error((e as Error).stack);
      const melding = e instanceof AvvistAvModellError ? e.message : (e as Error).message;
      await db.update(kildedokument).set({ feilmelding: `tolking: ${melding}`.slice(0, 500) }).where(eq(kildedokument.id, dok.id));
    }
    ferdig++;
    if (ferdig % 10 === 0 || ferdig === dokumenter.length) {
      console.log(`  ${ferdig}/${dokumenter.length}  flagget ${flagget}  feil ${feil}  $${kostnad.toFixed(2)}`);
    }
  });
}

main().catch((e) => {
  if (erKontofeil(e)) {
    console.error(`STOPP: ${(e as Error).message.slice(0, 200)}\nKjør skriptet på nytt når kontoen er i orden; det fortsetter der det slapp.`);
    process.exit(3);
  }
  console.error(e);
  process.exit(1);
});
