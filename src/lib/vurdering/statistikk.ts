import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { wilson } from "@/lib/data/statistikk";
import type { Faktorer } from "./faktorer";

export type Statistikk = {
  n: number;
  vunnet: number;
  andel: number;
  lav: number;
  hoy: number;
  // The share among all dealer decisions with the same timing as the sample (all dealer decisions
  // when the step does not match on timing). The sample only counts when it clearly differs from this.
  basis: number;
  // Which step of the relaxation ladder produced the sample (1 = most specific).
  trinn: number;
  beskrivelse: string;
  // The sample is matched on the defect, not just all dealer cases.
  spesifikk: boolean;
};

export type HentStatistikk = (f: Faktorer) => Promise<Statistikk>;

export const MIN_UTVALG = 30;
const VUNNET = sql`v.utfall in ('medhold','delvis_medhold')`;

const tekstListe = (verdier: string[]) => sql`ARRAY[${sql.join(verdier.map((v) => sql`${v}`), sql`, `)}]::text[]`;

function botteSql(f: Faktorer): SQL {
  switch (f.statistikkbotte) {
    case "rask":
      return sql`v.dager_til_reklamasjon <= 180`;
    case "middels":
      return sql`v.dager_til_reklamasjon between 181 and 730`;
    case "sen":
      return sql`v.dager_til_reklamasjon > 730`;
  }
}

// medBotte: the step matches on timing, so it is compared with all dealer decisions with that timing.
export type Trinn = { beskrivelse: string; betingelse: SQL; spesifikk: boolean; medBotte: boolean };

// Dealer cases only, from most to least specific; we use the first step with enough decisions.
// Each button the buyer picked is a group of defect types, matched with any of them (&&). With
// several groups we first require every group (AND), then any group (OR): matching on any alone
// made every extra tick look like a stronger case. Report and disclaimer are not matched: within
// the same defect and timing they barely move the share, and they are rules of their own.
export function trinnFor(f: Faktorer): Trinn[] {
  const trinn: Trinn[] = [];
  const botte = botteSql(f);
  const g = f.feilgrupper;
  if (g.length) {
    const treff = g.map((typer) => sql`v.feiltyper && ${tekstListe(typer)}`);
    const navn = g.map((typer) => typer.join("/")).join(" + ");
    if (g.length > 1) {
      const alle = sql.join(treff.map((t) => sql`(${t})`), sql` and `);
      trinn.push({ beskrivelse: `alle av ${navn} og reklamasjonstid`, betingelse: sql`${alle} and ${botte}`, spesifikk: true, medBotte: true });
      trinn.push({ beskrivelse: `alle av ${navn}`, betingelse: alle, spesifikk: true, medBotte: false });
    }
    const noen = sql`(${sql.join(treff.map((t) => sql`(${t})`), sql` or `)})`;
    trinn.push({ beskrivelse: `${navn} og reklamasjonstid`, betingelse: sql`${noen} and ${botte}`, spesifikk: true, medBotte: true });
    trinn.push({ beskrivelse: navn, betingelse: noen, spesifikk: true, medBotte: false });
  }
  trinn.push({ beskrivelse: "alle forhandlersaker", betingelse: sql`true`, spesifikk: false, medBotte: false });
  return trinn;
}

// One query that counts every step at once, plus all dealer decisions with the same timing (nb, vb).
// The last step is all dealer decisions, so it doubles as the baseline for steps without timing.
export const hentStatistikk: HentStatistikk = async (f) => {
  const trinn = trinnFor(f);
  const botte = botteSql(f);
  const kolonner = trinn.map(
    (t, i) =>
      sql`count(*) filter (where ${t.betingelse})::int as ${sql.identifier(`n${i}`)}, count(*) filter (where ${t.betingelse} and ${VUNNET})::int as ${sql.identifier(`v${i}`)}`,
  );
  kolonner.push(sql`count(*) filter (where ${botte})::int as nb, count(*) filter (where ${botte} and ${VUNNET})::int as vb`);
  const [rad] = (await db.execute(sql`select ${sql.join(kolonner, sql`, `)} from vedtak v where v.selger_type = 'forhandler'`)).rows as Record<
    string,
    number
  >[];

  let valgt = trinn.length - 1;
  for (let i = 0; i < trinn.length; i++) {
    if (Number(rad[`n${i}`]) >= MIN_UTVALG) {
      valgt = i;
      break;
    }
  }
  const n = Number(rad[`n${valgt}`]);
  const vunnet = Number(rad[`v${valgt}`]);
  const [lav, hoy] = wilson(vunnet, n);
  const t = trinn[valgt];
  const siste = trinn.length - 1;
  const [nBasis, vBasis] = t.medBotte ? [Number(rad.nb), Number(rad.vb)] : [Number(rad[`n${siste}`]), Number(rad[`v${siste}`])];
  return {
    n,
    vunnet,
    andel: n ? vunnet / n : 0,
    lav,
    hoy,
    basis: nBasis ? vBasis / nBasis : 0,
    trinn: valgt + 1,
    beskrivelse: t.beskrivelse,
    spesifikk: t.spesifikk,
  };
};
