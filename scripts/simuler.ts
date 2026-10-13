// Runs simulated buyer cases through the same chain as finnVedtak in src/app/sak/actions.ts (ranger →
// velgVedtak → template) and stores the paragraph, the fields it used, the model and the cost, for a
// field-by-field fact check against the full text.
//
//   npm run simuler -- <utfil.json>                 with the model's choice
//   UTEN_MODELL=1 npm run simuler -- <utfil.json>   the ranking's first candidate
//   FILTER=Turbo,Rust npm run simuler -- <utfil>    only cases whose name contains one of these

import { writeFileSync } from "node:fs";
import { inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import type { VisteSegValg } from "../src/lib/feil/kategorier";
import type { AvledetFeil } from "../src/lib/feilvurdering/skjema";
import { GRUNNFILTER } from "../src/lib/matching/grunnfilter";
import { ranger } from "../src/lib/matching/ranger";
import type { Kandidat, Krav } from "../src/lib/matching/typer";
import { byggSaken } from "../src/lib/vedtaksvalg/kjoper";
import { LOVSETNING, UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "../src/lib/vedtaksvalg/valg";

type Kilde = "skriftlig" | "muntlig" | "nei";
type Feilsvar = { hoved: string; under: string[]; tid: VisteSegValg; beskrivelse: string; opplysning: Kilde; verksted: Kilde };
type Sim = { navn: string; kjopsdato: string; km: number; ar: number; somDenEr: "ja" | "nei" | "vet_ikke"; krav: Krav; forsok: number; feil: Feilsvar[] };

const SAKER: Sim[] = [
  { navn: "Turbo kort etter kjøp", kjopsdato: "2025-03-10", km: 142_000, ar: 2017, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "motor", under: ["turbo"], tid: "innen_6_mnd", beskrivelse: "Bilen mistet kraft og ga feilmelding etter tre uker. Verkstedet fant defekt turbo.", opplysning: "nei", verksted: "skriftlig" }] },
  { navn: "Girkasse, kjøpt 2023", kjopsdato: "2023-05-02", km: 188_000, ar: 2012, somDenEr: "ja", krav: "heving", forsok: 2,
    feil: [{ hoved: "drivlinje", under: ["girkasse"], tid: "6_til_24_mnd", beskrivelse: "Automatgirkassen rykker og slipper ved giring. Selger har forsøkt å rette to ganger uten hell.", opplysning: "nei", verksted: "skriftlig" }] },
  { navn: "Rust etter over to år, som den er", kjopsdato: "2023-01-20", km: 245_000, ar: 2008, somDenEr: "ja", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "karosseri", under: ["rust"], tid: "over_24_mnd", beskrivelse: "Gjennomrust i bærende deler ble funnet på EU-kontroll. Bilen ble underkjent.", opplysning: "nei", verksted: "skriftlig" }] },
  { navn: "Servicehefte lovet i annonsen", kjopsdato: "2025-06-14", km: 160_000, ar: 2015, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "service", under: ["servicehefte"], tid: "innen_6_mnd", beskrivelse: "Annonsen sa «full servicehistorikk», men det mangler service for fire år.", opplysning: "skriftlig", verksted: "nei" }] },
  { navn: "Tilbakestilt kilometerstand", kjopsdato: "2024-09-01", km: 120_000, ar: 2014, somDenEr: "nei", krav: "heving", forsok: 0,
    feil: [{ hoved: "historikk", under: ["km"], tid: "6_til_24_mnd", beskrivelse: "Vegvesenets historikk viser 60 000 km mer enn telleren og kontrakten.", opplysning: "skriftlig", verksted: "nei" }] },
  { navn: "Elbil med lav batterikapasitet", kjopsdato: "2024-11-15", km: 70_000, ar: 2019, somDenEr: "nei", krav: "prisavslag", forsok: 1,
    feil: [{ hoved: "hoyvolt", under: ["kapasitet"], tid: "6_til_24_mnd", beskrivelse: "Rekkevidden har falt til halvparten. Batteritest viser 68 % helse.", opplysning: "muntlig", verksted: "skriftlig" }] },
  { navn: "Varsellampe, vet ikke årsak", kjopsdato: "2025-07-01", km: 95_000, ar: 2018, somDenEr: "vet_ikke", krav: "retting", forsok: 0,
    feil: [{ hoved: "vet_ikke", under: ["varsellampe"], tid: "innen_6_mnd", beskrivelse: "Motorlampen lyser og bilen går ujevnt på tomgang.", opplysning: "nei", verksted: "nei" }] },
  { navn: "Klima, bare hovedkategori", kjopsdato: "2024-04-10", km: 210_000, ar: 2011, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "klima", under: [], tid: "6_til_24_mnd", beskrivelse: "AC blåser bare varm luft.", opplysning: "nei", verksted: "muntlig" }] },
  { navn: "Bremser på eldre bil", kjopsdato: "2025-02-20", km: 230_000, ar: 2009, somDenEr: "ja", krav: "retting", forsok: 0,
    feil: [{ hoved: "understell", under: ["bremser"], tid: "innen_6_mnd", beskrivelse: "Bremsene trekker skjevt og kalipperen henger. Verkstedet sier den er rustet fast.", opplysning: "nei", verksted: "skriftlig" }] },
  { navn: "Oljeforbruk og lys, to kategorier", kjopsdato: "2024-08-05", km: 175_000, ar: 2013, somDenEr: "nei", krav: "heving", forsok: 2,
    feil: [
      { hoved: "motor", under: ["olje"], tid: "6_til_24_mnd", beskrivelse: "Motoren bruker en liter olje per 1000 km.", opplysning: "nei", verksted: "skriftlig" },
      { hoved: "elektrisk", under: ["lys"], tid: "innen_6_mnd", beskrivelse: "Fjernlyset virker ikke.", opplysning: "nei", verksted: "nei" },
    ] },
  { navn: "Garanti ikke som lovet", kjopsdato: "2025-01-05", km: 60_000, ar: 2020, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "garanti", under: [], tid: "innen_6_mnd", beskrivelse: "Forhandleren lovet 12 måneders bruktbilgaranti, men garantien ble aldri tegnet.", opplysning: "skriftlig", verksted: "nei" }] },
  { navn: "Nødmodus etter over to år", kjopsdato: "2023-03-01", km: 150_000, ar: 2017, somDenEr: "nei", krav: "retting", forsok: 0,
    feil: [{ hoved: "vet_ikke", under: ["nodmodus"], tid: "over_24_mnd", beskrivelse: "Bilen går i nødmodus i motorbakker.", opplysning: "nei", verksted: "skriftlig" }] },
];

async function main() {
  const utfil = process.argv[2];
  if (!utfil) throw new Error("Oppgi utfil.");
  const utenModell = !!process.env.UTEN_MODELL;
  const alle: Kandidat[] = await db
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
    .where(GRUNNFILTER);
  const etterId = new Map(alle.map((k) => [k.id, k]));

  async function kjor(x: Sim) {
    const { sak, kjoper } = byggSaken({ kjopsdato: x.kjopsdato, km: x.km, ar: x.ar, somDenEr: x.somDenEr === "vet_ikke" ? null : x.somDenEr, krav: x.krav, forsok: x.forsok, feil: x.feil });
    const { kandidater, perNiva } = ranger(alle, sak);
    const rader = await db
      .select({ id: vedtak.id, kildeUrl: vedtak.kildeUrl, utvalg: UTVALG_I_TEKSTEN, merke: vedtak.merke, modell: vedtak.modell, arsmodell: vedtak.arsmodell })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const detaljer = new Map<number, Vedtaksdetaljer>(rader.map(({ id, ...d }) => [id, d]));
    const start = Date.now();
    if (!kandidater.length) return { navn: x.navn, bruker: kjoper, sekunder: 0, modell: null, fulgt: false, forbruk: { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 }, perNiva, plass: 0, niva: null, avsnitt: LOVSETNING, felter: null };
    const svar = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer, utenModell });
    const r = svar.r;
    const k = etterId.get(r.id)!;
    const d = detaljer.get(k.id)!;
    return {
      navn: x.navn,
      bruker: kjoper,
      sekunder: Math.round((Date.now() - start) / 1000),
      modell: svar.modell,
      fulgt: svar.fulgt,
      forbruk: svar.forbruk,
      perNiva,
      plass: kandidater.findIndex((x) => x.id === k.id) + 1,
      niva: svar.niva,
      avsnitt: svar.avsnitt,
      // What the paragraph was built from, for the fact check.
      felter: {
        vedtak_id: k.id,
        fulltekst: `data/avgjorende/inn/${k.id}.txt`,
        utvalg: d.utvalg,
        saksnummer: k.saksnummer,
        vedtaksdato: k.vedtaksdato,
        bil: [d.merke, d.modell, d.arsmodell].filter(Boolean).join(" "),
        km: k.km,
        alder: k.alder,
        som_den_er: k.somDenEr,
        feil: r.feil ? { id: r.feil.id, komponent: r.feil.komponent, kategori: `${r.feil.hovedkategori}.${r.feil.underkategori}` } : null,
        sanksjoner: r.feil ? (k.avgjorende?.feil.find((a) => a.id === r.feil!.id)?.sanksjoner ?? []) : k.sanksjoner,
        rettslige_poeng: r.rett,
        sitater: svar.sitater,
      },
    };
  }

  const filter = process.env.FILTER?.split(",");
  const saker = filter ? SAKER.filter((x) => filter.some((f) => x.navn.includes(f))) : SAKER;
  const resultater: Awaited<ReturnType<typeof kjor>>[] = [];
  for (let i = 0; i < saker.length; i += 4) resultater.push(...(await Promise.all(saker.slice(i, i + 4).map(kjor))));
  writeFileSync(utfil, JSON.stringify(resultater, null, 1));

  let sum = 0;
  for (const r of resultater) {
    sum += r.forbruk.kostnadUsd;
    console.log(`${r.navn.padEnd(36)} nivå ${r.niva ?? "-"}  ${String(r.felter?.saksnummer ?? "lovsetning").padEnd(18)} plass ${String(r.plass).padStart(2)}  ${r.fulgt ? "modell " : "poeng  "} ${r.sekunder} s  ${r.forbruk.tokensInn} inn / ${r.forbruk.tokensUt} ut  $${r.forbruk.kostnadUsd.toFixed(4)}`);
  }
  console.log(`\n${resultater.length} avsnitt. Sum $${sum.toFixed(3)}, snitt $${(sum / Math.max(resultater.length, 1)).toFixed(4)} per brev.`);
  process.exit(0);
}
main();
