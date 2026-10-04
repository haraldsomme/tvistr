import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { normaliserFirmanavn, normaliserMerke } from "@/lib/normalisering";
import type { Faktorer } from "@/lib/vurdering/faktorer";
import { MIN_UTVALG, trinnFor } from "@/lib/vurdering/statistikk";
import { rens } from "./rens";
import type { BelopTall, BevisTall, EksempelVedtak, ForhandlerTall, Kvartiler, MappeData, ModellTall, TemaTall, UtvalgTall } from "./typer";

// The saksmappe's numbers, all from `vedtak` (redacted text only). The sample is the first step of
// the assessment's ladder with at least MIN_UTVALG decisions, so the file and the assessment agree.

const rader = async <T>(q: SQL) => (await db.execute(q)).rows as T[];
const FORHANDLER = sql`v.selger_type = 'forhandler'`;
const VUNNET = sql`v.utfall in ('medhold','delvis_medhold')`;
const TAPT = sql`v.utfall in ('ikke_medhold','avvist')`;

// What an example decision must satisfy to be shown or cited.
export const KVALIFISERT = sql`(not v.trenger_kontroll and v.konfidens >= 0.85 and v.qa_status <> 'feil' and v.sitater ? 'utfall'
  and v.saksnummer is not null and v.vedtaksdato is not null and v.kilde_url is not null and cardinality(v.utvalgets_nokkelmomenter) > 0)`;

const tall = (x: unknown) => (x === null || x === undefined ? null : Number(x));
const kvartiler = (n: unknown, p25: unknown, median: unknown, p75: unknown): Kvartiler | null =>
  Number(n) > 0 && median !== null && median !== undefined ? { n: Number(n), p25: Number(p25), median: Number(median), p75: Number(p75) } : null;

export function lagMappeData(f: Faktorer): MappeData {
  let valgt: Promise<{ nr: number; beskrivelse: string; spesifikk: boolean; betingelse: SQL }> | null = null;
  const trinn = () =>
    (valgt ??= (async () => {
      const alle = trinnFor(f);
      const kolonner = alle.map((t, i) => sql`count(*) filter (where ${t.betingelse})::int as ${sql.identifier(`n${i}`)}`);
      const [rad] = await rader<Record<string, number>>(sql`select ${sql.join(kolonner, sql`, `)} from vedtak v where ${FORHANDLER}`);
      let i = alle.length - 1;
      for (let k = 0; k < alle.length; k++) {
        if (Number(rad[`n${k}`]) >= MIN_UTVALG) {
          i = k;
          break;
        }
      }
      return { nr: i + 1, beskrivelse: alle[i].beskrivelse, spesifikk: alle[i].spesifikk, betingelse: alle[i].betingelse };
    })());
  const utvalgSql = async () => sql`${FORHANDLER} and (${(await trinn()).betingelse})`;

  return {
    async utvalg(): Promise<UtvalgTall> {
      const t = await trinn();
      const [r] = await rader<Record<string, number>>(sql`select count(*)::int n,
          count(*) filter (where v.utfall = 'medhold')::int fullt,
          count(*) filter (where v.utfall = 'delvis_medhold')::int delvis,
          count(*) filter (where ${TAPT})::int avslag
        from vedtak v where ${await utvalgSql()}`);
      return { n: Number(r.n), fullt: Number(r.fullt), delvis: Number(r.delvis), avslag: Number(r.avslag), trinn: t.nr, beskrivelse: t.beskrivelse, spesifikk: t.spesifikk };
    },

    async belop(): Promise<BelopTall> {
      const [r] = await rader<Record<string, unknown>>(sql`select
          count(*) filter (where v.tilkjent_totalt_nok > 0)::int t_n,
          percentile_cont(0.25) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) t_p25,
          percentile_cont(0.5) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) t_med,
          percentile_cont(0.75) within group (order by v.tilkjent_totalt_nok) filter (where v.tilkjent_totalt_nok > 0) t_p75,
          count(*) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0)::int p_n,
          percentile_cont(0.25) within group (order by v.tilkjent_prisavslag_nok::float / nullif(v.utbedringskostnad_nok, 0)) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0) p_p25,
          percentile_cont(0.5) within group (order by v.tilkjent_prisavslag_nok::float / nullif(v.utbedringskostnad_nok, 0)) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0) p_med,
          percentile_cont(0.75) within group (order by v.tilkjent_prisavslag_nok::float / nullif(v.utbedringskostnad_nok, 0)) filter (where v.tilkjent_prisavslag_nok > 0 and v.utbedringskostnad_nok > 0) p_p75,
          count(*) filter (where v.prinsipalt_krav = 'heving')::int h_n,
          count(*) filter (where v.prinsipalt_krav = 'heving' and v.utfall = 'medhold')::int h_fullt,
          count(*) filter (where v.prinsipalt_krav = 'heving' and v.utfall = 'delvis_medhold')::int h_delvis,
          count(*) filter (where v.krevd_erstatning_nok > 0)::int e_krevd,
          count(*) filter (where v.tilkjent_erstatning_nok > 0)::int e_tilkjent,
          percentile_cont(0.5) within group (order by v.tilkjent_erstatning_nok) filter (where v.tilkjent_erstatning_nok > 0) e_med
        from vedtak v where ${await utvalgSql()}`);
      const hn = Number(r.h_n);
      return {
        tilkjent: kvartiler(r.t_n, r.t_p25, r.t_med, r.t_p75),
        prisavslagAvUtbedring: kvartiler(r.p_n, r.p_p25, r.p_med, r.p_p75),
        heving: hn > 0 ? { n: hn, fullt: Number(r.h_fullt), delvis: Number(r.h_delvis), ikke: hn - Number(r.h_fullt) - Number(r.h_delvis) } : null,
        erstatning: { nKrevd: Number(r.e_krevd), nTilkjent: Number(r.e_tilkjent), median: tall(r.e_med) },
      };
    },

    async temaer(): Promise<TemaTall> {
      const betingelse = await utvalgSql();
      const [sum] = await rader<{ medhold: number; avslag: number }>(sql`select count(*) filter (where ${VUNNET})::int medhold, count(*) filter (where ${TAPT})::int avslag from vedtak v where ${betingelse}`);
      const kilde = (navn: "tvistetema" | "bevistyper" | "mangelsgrunnlag") =>
        sql`select ${navn}::text kilde, t verdi, count(*) filter (where ${VUNNET})::int n_medhold, count(*) filter (where ${TAPT})::int n_avslag
            from vedtak v, unnest(v.${sql.identifier(navn)}) t where ${betingelse} group by t`;
      const alle = await rader<{ kilde: TemaTall["rader"][number]["kilde"]; verdi: string; n_medhold: number; n_avslag: number }>(
        sql`${kilde("tvistetema")} union all ${kilde("bevistyper")} union all ${kilde("mangelsgrunnlag")}`,
      );
      return { medhold: Number(sum.medhold), avslag: Number(sum.avslag), rader: alle.map((a) => ({ kilde: a.kilde, verdi: a.verdi, nMedhold: Number(a.n_medhold), nAvslag: Number(a.n_avslag) })) };
    },

    async eksempler(): Promise<EksempelVedtak[]> {
      const betingelse = await utvalgSql();
      const velg = (utfall: SQL, grense: number) => sql`select v.id, v.saksnummer, extract(year from v.vedtaksdato)::int ar, v.utfall, v.tilkjent_totalt_nok, v.sammendrag,
          v.utvalgets_nokkelmomenter momenter, v.kilde_url, v.merke, v.modell, v.dager_til_reklamasjon
        from vedtak v where ${betingelse} and ${KVALIFISERT} and ${utfall} order by v.vedtaksdato desc limit ${grense}`;
      const [vunne, tapte] = await Promise.all([rader<Record<string, unknown>>(velg(VUNNET, 3)), rader<Record<string, unknown>>(velg(sql`v.utfall = 'ikke_medhold'`, 2))]);
      return [...vunne, ...tapte].map(tilEksempel);
    },

    async forhandler(navn, orgnr): Promise<ForhandlerTall | null> {
      const norm = navn ? normaliserFirmanavn(navn) : null;
      const brukNorm = norm !== null && norm !== "null" && norm.length >= 3;
      if (!orgnr && !brukNorm) return null;
      const treff = orgnr && brukNorm ? sql`(v.selger_orgnr = ${orgnr} or v.selger_navn_norm = ${norm})` : orgnr ? sql`v.selger_orgnr = ${orgnr}` : sql`v.selger_navn_norm = ${norm}`;
      const [r] = await rader<{ n: number; vunnet: number; siste_ar: number | null }>(
        sql`select count(*)::int n, count(*) filter (where ${VUNNET})::int vunnet, max(extract(year from v.vedtaksdato))::int siste_ar from vedtak v where ${treff}`,
      );
      const ft = await rader<{ verdi: string; n: number }>(sql`select ft verdi, count(*)::int n from vedtak v, unnest(v.feiltyper) ft where ${treff} group by ft order by n desc limit 3`);
      return { n: Number(r.n), vunnet: Number(r.vunnet), sisteAr: tall(r.siste_ar), feiltyper: ft.map((x) => ({ verdi: x.verdi, n: Number(x.n) })) };
    },

    async modell(merke, modell): Promise<ModellTall> {
      const m = normaliserMerke(merke);
      if (!m) return { n: 0, vunnet: 0 };
      const [r] = await rader<{ n: number; vunnet: number }>(
        sql`select count(*)::int n, count(*) filter (where ${VUNNET})::int vunnet from vedtak v where ${FORHANDLER} and v.merke = ${m} and lower(v.modell) = lower(${modell})`,
      );
      return { n: Number(r.n), vunnet: Number(r.vunnet) };
    },

    async bevis(): Promise<BevisTall> {
      const [r] = await rader<Record<string, number>>(sql`select count(*) filter (where ${VUNNET})::int n_medhold,
          count(*) filter (where ${VUNNET} and 'verkstedrapport' = any(v.bevistyper))::int verkstedrapport,
          count(*) filter (where ${VUNNET} and 'bilder' = any(v.bevistyper))::int bilder,
          count(*) filter (where ${VUNNET} and 'takst' = any(v.bevistyper))::int takst,
          count(*) filter (where ${VUNNET} and 'NAF_test' = any(v.bevistyper))::int naf,
          count(*) filter (where ${VUNNET} and 'kvittering' = any(v.bevistyper))::int kvittering
        from vedtak v where ${await utvalgSql()}`);
      return { nMedhold: Number(r.n_medhold), verkstedrapport: Number(r.verkstedrapport), bilder: Number(r.bilder), takst: Number(r.takst), naf: Number(r.naf), kvittering: Number(r.kvittering) };
    },
  };
}

function tilEksempel(r: Record<string, unknown>): EksempelVedtak {
  return {
    id: Number(r.id),
    saksnummer: String(r.saksnummer),
    ar: Number(r.ar),
    utfall: r.utfall as EksempelVedtak["utfall"],
    tilkjentNok: tall(r.tilkjent_totalt_nok),
    sammendrag: r.sammendrag ? rens(String(r.sammendrag)) : null,
    momenter: ((r.momenter as string[] | null) ?? []).slice(0, 10).map(rens),
    kildeUrl: String(r.kilde_url),
    merke: (r.merke as string | null) ?? null,
    modell: (r.modell as string | null) ?? null,
    dagerTilReklamasjon: tall(r.dager_til_reklamasjon),
  };
}
