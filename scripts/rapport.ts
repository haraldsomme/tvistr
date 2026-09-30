// Writes docs/datagrunnlag.md from the database: counts per archive and year, classification,
// field coverage, QA accuracy and cost. Contains no personal data (only aggregates).
//
//   npm run rapport

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { datakvalitet, nokkeltall, vinnersjanse, type Gruppe } from "../src/lib/data/statistikk";

type Rad = Record<string, unknown>;
const rows = async <T = Rad>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
const pst = (v: number) => `${Math.round(v * 100)} %`;
const kr = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v).toLocaleString("nb-NO")} kr`);

function tabell(hode: string[], linjer: (string | number)[][]): string {
  return [`| ${hode.join(" | ")} |`, `| ${hode.map(() => "---").join(" | ")} |`, ...linjer.map((l) => `| ${l.join(" | ")} |`)].join("\n");
}

function vinnTabell(tittel: string, g: Gruppe[]): string {
  return `**${tittel}**\n\n${tabell(
    ["Gruppe", "Saker", "Medhold", "95 % intervall"],
    g.map((x) => [x.gruppe.replaceAll("_", " "), x.n, pst(x.andel), `${pst(x.lav)}–${pst(x.hoy)}`]),
  )}`;
}

async function main() {
  const perArkiv = await rows<{ arkiv: string; status: string; n: number }>(sql`
    select kilde_arkiv arkiv, status, count(*)::int n from kildesak group by 1, 2 order by 1, 2`);
  const perAr = await rows<{ ar: number; hist: number; prod: number; wp: number; totalt: number }>(sql`
    select ar,
      count(*) filter (where kilde_arkiv = 'hist')::int hist,
      count(*) filter (where kilde_arkiv = 'prod')::int prod,
      count(*) filter (where kilde_arkiv = 'wp')::int wp,
      count(*)::int totalt
    from kildedokument where lokal_sti is not null group by 1 order by 1`);
  const klass = await rows<{ status: string; er_bruktbil: boolean | null; n: number }>(sql`
    select status, er_bruktbil, count(*)::int n from kildedokument group by 1, 2 order by 1, 2`);
  const kategorier = await rows<{ kategori: string; n: number }>(sql`
    select split_part(klassifisering_begrunnelse, ':', 1) kategori, count(*)::int n
    from kildedokument where klassifisering_begrunnelse is not null group by 1 order by 2 desc`);
  const [kost] = await rows<{ klassifisering: number; klassifisert: number; tolking: number; tolket: number; sek: number }>(sql`
    select (select coalesce(sum(kostnad_usd), 0) from kildedokument) klassifisering,
      (select count(*)::int from kildedokument where klassifisering_begrunnelse is not null) klassifisert,
      (select coalesce(sum(kostnad_usd), 0) from vedtak) tolking,
      (select count(*)::int from vedtak) tolket,
      (select coalesce(avg(varighet_ms), 0) / 1000 from vedtak) sek`);
  const versjoner = await rows<{ prompt_versjon: string; ai_modell: string; n: number }>(sql`
    select prompt_versjon, ai_modell, count(*)::int n from vedtak group by 1, 2 order by 1`);
  const tolkefeil = await rows<{ n: number }>(sql`select count(*)::int n from kildedokument where feilmelding like 'tolking:%'`);

  const revisjon = existsSync("docs/revisjon.json")
    ? (JSON.parse(readFileSync("docs/revisjon.json", "utf8")) as { tidspunkt: string; utvalg: number; tell: Record<string, { riktig: number; feil: number; usikker: number }> })
    : null;
  const personvern = existsSync("docs/personvernkontroll.json")
    ? (JSON.parse(readFileSync("docs/personvernkontroll.json", "utf8")) as { tidspunkt: string; telling: Record<"flagget" | "tilfeldig", { n: number; medNavn: number; medAnnet: number; funnNavn: number }> })
    : null;

  const tall = await nokkeltall();
  const vinn = await vinnersjanse();
  const kval = await datakvalitet();

  const klassifisert = Number(kost.klassifisert);
  const tolket = Number(kost.tolket);
  const bruktbil = klass.filter((k) => k.er_bruktbil).reduce((a, k) => a + k.n, 0);

  const md = `# Datagrunnlag for Tvistr

*Generert ${new Date().toISOString().slice(0, 16).replace("T", " ")} med \`npm run rapport\`. Tallene er hentet direkte fra databasen; seksjonen «Kjente hull og svakheter» vedlikeholdes i \`scripts/rapport.ts\`.*

## 1. Innhenting

Kilder: Forbrukertvistutvalget (\`hist\`, innsyn.onacos.no, til og med 2020), Forbrukerklageutvalget 2021–mai 2025 (\`prod\`, innsyn.onacos.no) og Forbrukerklageutvalget etter mai 2025 (\`wp\`, forbrukertilsynet.no). Utvalg: saker klassifisert som brukt bil og campingvogn/bobil, i \`hist\` også tittelsøk på «bruktbil», «brukt bil» og «bobil» for den uklassifiserte perioden 2018–2020; i \`wp\` kategori «Kjøretøy». Vedtak før 2013 er hoppet over.

**Saker per arkiv og status**

${tabell(
  ["Arkiv", "Status", "Saker"],
  perArkiv.map((r) => [r.arkiv, r.status, r.n]),
)}

**Nedlastede vedtak per år**

${tabell(
  ["År", "hist", "prod", "wp", "Totalt"],
  perAr.map((r) => [r.ar ?? "ukjent", r.hist, r.prod, r.wp, r.totalt]),
)}

## 2. Klassifisering

${klassifisert} dokumenter er klassifisert; ${bruktbil} gjelder kjøp av brukt kjøretøy.

${tabell(
  ["Kategori", "Dokumenter"],
  kategorier.map((k) => [k.kategori.replaceAll("_", " "), k.n]),
)}

## 3. Tolkede vedtak

${tolket} vedtak er tolket (${tolkefeil[0].n} feilet og kan kjøres på nytt). Prompt- og modellversjoner:

${tabell(
  ["Prompt", "Modell", "Vedtak"],
  versjoner.map((v) => [v.prompt_versjon, v.ai_modell, v.n]),
)}

**Nøkkeltall:** median krevd ${kr(tall.median_krevd)}, median tilkjent når noe ble tilkjent ${kr(tall.median_tilkjent_vunnet)}.

${tabell(
  ["Utfall", "Vedtak", "Andel"],
  tall.utfall.map((u) => [String(u.utfall ?? "ukjent").replaceAll("_", " "), u.n, pst(u.n / tall.n)]),
)}

${vinnTabell("Vinnersjanse per selgertype", vinn.perSelger)}

${vinnTabell("Vinnersjanse per feiltype", vinn.perFeiltype)}

${vinnTabell("Vinnersjanse per mangelsgrunnlag", vinn.perGrunnlag)}

## 4. Feltdekning

Andel av tolkede vedtak der feltet har en verdi. Lav dekning betyr at opplysningen sjelden står i vedtaket, ikke nødvendigvis at uttrekket er feil (f.eks. står tilkjent beløp bare når klager fikk medhold).

${tabell(
  ["Felt", "Utfylt", "Andel"],
  kval.dekning.map((d) => [d.felt, d.utfylt, pst(d.andel)]),
)}

## 5. Kvalitet og treffsikkerhet

- Flagget for manuell kontroll: **${kval.flagget} av ${kval.n}** (${kval.n ? pst(kval.flagget / kval.n) : "–"}).
- Kontrollert manuelt (\`qa_status\` i \`vedtak\`): **${kval.kontrollert}**, hvorav **${kval.riktig} riktige** og **${kval.feil} feil**${kval.kontrollert ? ` – treffsikkerhet ${pst(kval.riktig / kval.kontrollert)}` : ""}.
- Gjennomsnittlig konfidens fra modellen: ${kval.snitt_konfidens != null ? Number(kval.snitt_konfidens).toFixed(2) : "–"}.

**Flagg og kontroll.** «Flagget» betyr at koden fant noe som bør sees på (lav konfidens, beløp uten støtte i teksten, utfall som ikke stemmer med beløpene, gjenværende personnavn som ble fjernet). Flaggene er revurdert etter tolkingen (\`npm run revurder\`): sitater sammenlignes på bokstaver og tall, beløp uten modellens sitat får et ordrett utdrag fra teksten hvis beløpet står der, og totaler som er summen av delbeløp eller lik kjøpesummen godtas som avledede.

**Vanligste grunner til flagg**

${tabell(
  ["Grunn", "Vedtak"],
  kval.arsaker.map((a) => [a.arsak, a.n]),
)}

### Automatisk revisjon (ikke menneskelig kontroll)

${revisjon ? `En modell leste vedtaksteksten på nytt og vurderte de uttrukne feltene i et tilfeldig utvalg på ${revisjon.utvalg} vedtak (\`npm run revisjon\`). Dette er en **andre mening fra samme modellfamilie**, ikke menneskelig kontroll; blindsoner kan være felles, og tallene kan ikke erstatte manuell kontroll. \`qa_status\` er urørt.

${tabell(
  ["Felt", "Riktig", "Feil", "Usikker", "Riktig av vurderte"],
  Object.entries(revisjon.tell).map(([f, t]) => [f.replaceAll("_", " "), t.riktig, t.feil, t.usikker, pst(t.riktig / Math.max(1, t.riktig + t.feil + t.usikker))]),
)}

Revisjonen avdekket en feil i normaliseringen av paragrafer (paragrafer i andre lover, f.eks. forsinkelsesrenteloven § 2, ble merket som forbrukerkjøpsloven). Den er rettet, og «lov og paragrafer» gikk fra 51 % til 89 %. Feltene «feiltyper» og «forbehold» scorer lavest, se «Kjente hull».` : "Ikke kjørt."}

### Personvernkontroll

${personvern ? `Et uavhengig kontrollkall leste de lagrede (rensede) tekstfeltene på nytt (\`npm run personvern\`). Blant **${personvern.telling.tilfeldig.n} tilfeldige** vedtak fant den personnavn i **${personvern.telling.tilfeldig.medNavn}**; blant **${personvern.telling.flagget.n} vedtak som allerede var flagget for navn** fant den navn i ${personvern.telling.flagget.medNavn} (fjernet). Med 0 av ${personvern.telling.tilfeldig.n} er den øvre 95 %-grensen for andelen vedtak med gjenværende navn (som modellen kan finne) omtrent ${Math.round((3 / personvern.telling.tilfeldig.n) * 1000) / 10} %. Et navn som ingen av de to gjennomgangene ser, fanges ikke.` : "Ikke kjørt."}

## 6. Kostnad

| Steg | Dokumenter | Kostnad | Per dokument |
| --- | --- | --- | --- |
| Klassifisering | ${klassifisert} | $${Number(kost.klassifisering).toFixed(2)} | $${klassifisert ? (Number(kost.klassifisering) / klassifisert).toFixed(4) : "–"} |
| Tolking inkl. personvernkontroll | ${tolket} | $${Number(kost.tolking).toFixed(2)} | $${tolket ? (Number(kost.tolking) / tolket).toFixed(4) : "–"} |

Tolking tar i snitt ${Number(kost.sek).toFixed(0)} sekunder per vedtak (8 parallelle kall i full kjøring). Modell: claude-sonnet-5-5. Kostnaden for kall som feilet eller ble tolket på nytt er ikke med i tallene over.

## 7. Kjente hull og svakheter

${kjenteHull(kval.n)}
`;

  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/datagrunnlag.md", md);
  console.log(`Skrev docs/datagrunnlag.md (${tolket} tolkede vedtak).`);
}

const kjenteHull = (antall: number) => `- **Utvalgsskjevhet:** Bare saker som endte med vedtak er med. Forlik, trukne saker og saker løst før utvalget mangler, så «vinnersjanse» betyr sjanse *gitt at saken går til vedtak*.
- **robots.txt:** innsyn.onacos.no forbyr automatisert henting i robots.txt. Prosjekteier valgte å hente likevel (2026-09-29), med lavt tempo og tydelig User-Agent. Forbrukertilsynet bør kontaktes om varig tilgang.
- **Klassifiseringshull i hist:** Forbrukertvistutvalget sluttet å klassifisere saker i 2018. Saker fra 2018–2020 er funnet med tittelsøk, som kan ha oversett bruktbilsaker som ikke nevner «bruktbil», «brukt bil» eller «bobil».
- **Feilklassifiserte saker:** Bruktbilsaker som arkivet har lagt under andre kategorier (f.eks. «Andre kjøretøy», «Verkstedtjenester») er ikke hentet.
- **2020 og 2024–2025:** Få vedtak i 2020 (overgangen fra Forbrukertvistutvalget til Forbrukerklageutvalget) og i 2025 (prod-arkivet slutter i mai, wp-arkivet starter i juli).
- **Org.nr.:** Selgers organisasjonsnummer står sjelden i vedtakene, så oppslag på forhandler skjer mest på normalisert firmanavn.
- **Lovversjon:** Vedtakene sier sjelden eksplisitt hvilken lovversjon som gjelder; feltet er stort sett «ukjent».
- **Personvern:** Navn fjernes i to trinn (modellens liste + kode, deretter et uavhengig kontrollkall). Firmanavn som inneholder et personnavn (enkeltpersonforetak) beholdes som firmanavn. Rå PDF-er ligger bare lokalt.
- **Etterkontroll av personvern (2026-09-30):** Et søk etter 60 vanlige fornavn i alle rensede fulltekster ga 249 treff i 107 vedtak. Nesten alle var firmanavn (særlig importøren Harald A. Møller AS), «Per»/«Hans» brukt som vanlige ord, bilmodeller og gatenavn i firmaadresser. Tre vedtak hadde reelle rester (navnefragmenter i en ødelagt tabell, en fullmektigs adresse i løpende tekst og forfatternavn i en litteraturhenvisning); de er fjernet med kode og flagget. Søket fanger bare vanlige fornavn – sjeldne navn kan fortsatt finnes og må fanges i kvalitetssjekken.
- **Feiltyper er «påberopt», ikke «godtatt»:** Feltet viser feilene klageren gjorde gjeldende. Ved delvis medhold vet vi ikke hvilke av dem utvalget godtok. Vinnersjanse per feiltype er derfor skjev oppover for feiltyper som ofte påberopes sammen med andre (en avvist «motor» i en sak der «girkasse» ble godtatt, teller som medhold). Automatisk revisjon ga bare ~60 % riktig på dette feltet av samme grunn. Løsning: nytt felt \`godtatte_feiltyper\` i en ny promptversjon (tolk-v4); krever ny tolking (cirka $180).
- **Forbehold:** Revisjonen er usikker på nesten hver femte; vedtakene angir forbehold i kjøpekontrakt og annonse på ulike måter.
- **Lovversjon:** Stort sett «ukjent», fordi vedtakene sjelden sier eksplisitt hvilken versjon som gjelder.
- **Automatiske sitater:** For rundt tusen beløp er sitatet et ordrett utdrag hentet fra teksten med kode (beløpet står der), ikke modellens eget sitat. Merket som «merknad» i \`kontroll_arsaker\`.
- **Avledede totaler:** Totalbeløp som ikke står i teksten, men som er summen av to beløp i teksten, godtas (f.eks. kjøpesum + erstatning ved heving).
- **Menneskelig kvalitetssjekk:** Bare 30 av ${antall} vedtak er kontrollert manuelt (alle riktige, pilotutvalget). Manuelle kontroller føres i \`vedtak.qa_status\` / \`qa_kommentar\`; tallene over oppdateres med \`npm run rapport\`. Det finnes ikke lenger noe grensesnitt for dette (siden /data er fjernet).`;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
