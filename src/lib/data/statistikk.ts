import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

// Shared by the /data page and the `rapport` script. All numbers come from `vedtak`, which
// only holds redacted data.

type Rad = Record<string, unknown>;
const rows = async <T = Rad>(q: SQL) => (await db.execute(q)).rows as T[];

export type Gruppe = { gruppe: string; n: number; vunnet: number; andel: number; lav: number; hoy: number };

// 95 % Wilson interval for a proportion; honest for small groups.
export function wilson(vunnet: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = vunnet / n;
  const d = 1 + (z * z) / n;
  const senter = (p + (z * z) / (2 * n)) / d;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, senter - margin), Math.min(1, senter + margin)];
}

function tilGrupper(r: { gruppe: string | null; n: number; vunnet: number }[]): Gruppe[] {
  return r
    .map((x) => {
      const n = Number(x.n);
      const vunnet = Number(x.vunnet);
      const [lav, hoy] = wilson(vunnet, n);
      return { gruppe: x.gruppe ?? "ukjent", n, vunnet, andel: n ? vunnet / n : 0, lav, hoy };
    })
    .sort((a, b) => b.n - a.n);
}

export function filterSql(kjoretoytype?: string | null): SQL {
  return kjoretoytype ? sql`v.kjoretoytype = ${kjoretoytype}` : sql`true`;
}

const VUNNET = sql`count(*) filter (where v.utfall in ('medhold','delvis_medhold'))::int`;
const AR = sql`coalesce(extract(year from v.vedtaksdato)::int, k.ar)`;

export async function nokkeltall(kjoretoytype?: string | null) {
  const f = filterSql(kjoretoytype);
  const [tot] = await rows<{ n: number; median_krevd: number | null; median_tilkjent: number | null; median_tilkjent_vunnet: number | null }>(sql`
    select count(*)::int n,
      percentile_cont(0.5) within group (order by v.krevd_totalt_nok) median_krevd,
      percentile_cont(0.5) within group (order by v.tilkjent_totalt_nok) median_tilkjent,
      percentile_cont(0.5) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) median_tilkjent_vunnet
    from vedtak v where ${f}`);
  const perAr = await rows<{ ar: number | null; n: number }>(sql`
    select ${AR} ar, count(*)::int n from vedtak v join kildedokument k on k.id = v.kildedokument_id
    where ${f} group by 1 order by 1`);
  const utfall = await rows<{ utfall: string | null; n: number }>(sql`
    select v.utfall, count(*)::int n from vedtak v where ${f} group by 1 order by 2 desc`);
  const selger = await rows<{ selger_type: string | null; n: number }>(sql`
    select v.selger_type, count(*)::int n from vedtak v where ${f} group by 1 order by 2 desc`);
  const kjoretoy = await rows<{ kjoretoytype: string | null; n: number }>(sql`
    select v.kjoretoytype, count(*)::int n from vedtak v group by 1 order by 2 desc`);
  const merker = await rows<{ merke: string | null; n: number }>(sql`
    select v.merke, count(*)::int n from vedtak v where ${f} and v.merke is not null group by 1 order by 2 desc`);
  return { ...tot, perAr, utfall, selger, kjoretoy, merker };
}

export async function vinnersjanse(kjoretoytype?: string | null) {
  const f = filterSql(kjoretoytype);
  const perFeiltype = tilGrupper(
    await rows(sql`select ft gruppe, count(*)::int n, ${VUNNET} vunnet
      from vedtak v, unnest(v.feiltyper) ft where ${f} group by 1`),
  );
  const perSelger = tilGrupper(
    await rows(sql`select v.selger_type::text gruppe, count(*)::int n, ${VUNNET} vunnet from vedtak v where ${f} group by 1`),
  );
  const perForbehold = tilGrupper(
    await rows(sql`select case when 'som_den_er' = any(v.forbehold) then 'solgt «som den er»' else 'uten «som den er»' end gruppe,
      count(*)::int n, ${VUNNET} vunnet from vedtak v where ${f} group by 1`),
  );
  const perBevis = tilGrupper(
    await rows(sql`select case when 'verkstedrapport' = any(v.bevistyper) then 'med verkstedrapport' else 'uten verkstedrapport' end gruppe,
      count(*)::int n, ${VUNNET} vunnet from vedtak v where ${f} group by 1`),
  );
  const perKrav = tilGrupper(
    await rows(sql`select case
        when v.krevd_totalt_nok is null then 'krav ikke oppgitt'
        when v.krevd_totalt_nok < 20000 then 'under 20 000 kr'
        when v.krevd_totalt_nok <= 50000 then '20 000–50 000 kr'
        else 'over 50 000 kr' end gruppe,
      count(*)::int n, ${VUNNET} vunnet from vedtak v where ${f} group by 1`),
  );
  const perGrunnlag = tilGrupper(
    await rows(sql`select g gruppe, count(*)::int n, ${VUNNET} vunnet from vedtak v, unnest(v.mangelsgrunnlag) g where ${f} group by 1`),
  );
  const perTvistetema = tilGrupper(
    await rows(sql`select g gruppe, count(*)::int n, ${VUNNET} vunnet from vedtak v, unnest(v.tvistetema) g where ${f} group by 1`),
  );
  const perHovedkrav = tilGrupper(
    await rows(sql`select coalesce(v.prinsipalt_krav, 'ukjent') gruppe, count(*)::int n, ${VUNNET} vunnet from vedtak v where ${f} group by 1`),
  );
  return { perFeiltype, perSelger, perForbehold, perBevis, perKrav, perGrunnlag, perTvistetema, perHovedkrav };
}

// Share of decisions where each field has a value (arrays: at least one element).
const FELT: [string, SQL][] = [
  ["vedtaksdato", sql`v.vedtaksdato is not null`],
  ["kjoretoytype", sql`v.kjoretoytype is not null`],
  ["selger_type (ikke ukjent)", sql`v.selger_type is not null and v.selger_type <> 'ukjent'`],
  ["selger_navn (forhandler)", sql`v.selger_navn is not null or v.selger_type <> 'forhandler'`],
  ["selger_orgnr", sql`v.selger_orgnr is not null`],
  ["merke", sql`v.merke is not null`],
  ["modell", sql`v.modell is not null`],
  ["arsmodell", sql`v.arsmodell is not null`],
  ["drivstoff", sql`v.drivstoff is not null`],
  ["km_ved_kjop", sql`v.km_ved_kjop is not null`],
  ["kjopesum_nok", sql`v.kjopesum_nok is not null`],
  ["kjopsdato", sql`v.kjopsdato is not null`],
  ["overtakelsesdato", sql`v.overtakelsesdato is not null`],
  ["forste_reklamasjon_dato", sql`v.forste_reklamasjon_dato is not null`],
  ["dager_til_reklamasjon", sql`v.dager_til_reklamasjon is not null`],
  ["forbehold", sql`cardinality(v.forbehold) > 0`],
  ["feiltyper", sql`cardinality(v.feiltyper) > 0`],
  ["utbedringskostnad_nok", sql`v.utbedringskostnad_nok is not null`],
  ["bevistyper", sql`cardinality(v.bevistyper) > 0`],
  ["kravtyper", sql`cardinality(v.kravtyper) > 0`],
  ["prinsipalt_krav", sql`v.prinsipalt_krav is not null`],
  ["mangelsgrunnlag", sql`cardinality(v.mangelsgrunnlag) > 0`],
  ["tvistetema", sql`cardinality(v.tvistetema) > 0`],
  ["krevd_totalt_nok", sql`v.krevd_totalt_nok is not null`],
  ["utfall", sql`v.utfall is not null`],
  ["tilkjent_totalt_nok", sql`v.tilkjent_totalt_nok is not null`],
  ["enstemmig", sql`v.enstemmig is not null`],
  ["lov", sql`v.lov is not null`],
  ["lovversjon (ikke ukjent)", sql`v.lovversjon is not null and v.lovversjon <> 'ukjent'`],
  ["paragrafer", sql`cardinality(v.paragrafer) > 0`],
  ["sammendrag", sql`v.sammendrag is not null`],
  ["sitat for utfall", sql`v.sitater ? 'utfall'`],
];

export async function datakvalitet() {
  const utvalg = FELT.map(([navn, betingelse]) => sql`count(*) filter (where ${betingelse})::int as ${sql.identifier(navn)}`);
  const [r] = await rows(sql`select count(*)::int as n, ${sql.join(utvalg, sql`, `)} from vedtak v`);
  const n = Number(r.n);
  const dekning = FELT.map(([navn]) => ({ felt: navn, utfylt: Number(r[navn]), andel: n ? Number(r[navn]) / n : 0 }));
  const [qa] = await rows<{ flagget: number; kontrollert: number; riktig: number; feil: number; snitt_konfidens: number | null; kostnad: number | null }>(sql`
    select count(*) filter (where trenger_kontroll)::int flagget,
      count(*) filter (where qa_status <> 'ukontrollert')::int kontrollert,
      count(*) filter (where qa_status = 'riktig')::int riktig,
      count(*) filter (where qa_status = 'feil')::int feil,
      avg(konfidens) snitt_konfidens,
      sum(kostnad_usd) kostnad
    from vedtak`);
  const arsaker = await rows<{ arsak: string; n: number }>(sql`
    select regexp_replace(a, '\\s*[:(].*$', '') arsak, count(*)::int n
    from vedtak, unnest(kontroll_arsaker) a where a not like 'merknad:%' group by 1 order by 2 desc limit 12`);
  return { n, dekning, ...qa, arsaker };
}
