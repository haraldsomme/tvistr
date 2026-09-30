import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { kildedokument, vedtak } from "@/db/schema";

export type Filter = {
  kjoretoy?: string;
  feiltype?: string;
  utfall?: string;
  ar?: string;
  selger?: string;
};

const felt = {
  id: vedtak.id,
  saksnummer: vedtak.saksnummer,
  vedtaksdato: vedtak.vedtaksdato,
  ar: kildedokument.ar,
  arkiv: kildedokument.kildeArkiv,
  kildeUrl: vedtak.kildeUrl,
  kjoretoytype: vedtak.kjoretoytype,
  selgerType: vedtak.selgerType,
  selgerNavn: vedtak.selgerNavn,
  selgerOrgnr: vedtak.selgerOrgnr,
  verkstedNavn: vedtak.verkstedNavn,
  merke: vedtak.merke,
  modell: vedtak.modell,
  arsmodell: vedtak.arsmodell,
  drivstoff: vedtak.drivstoff,
  kmVedKjop: vedtak.kmVedKjop,
  kjopesumNok: vedtak.kjopesumNok,
  kjopsdato: vedtak.kjopsdato,
  forsteReklamasjonDato: vedtak.forsteReklamasjonDato,
  dagerTilReklamasjon: vedtak.dagerTilReklamasjon,
  forbehold: vedtak.forbehold,
  feiltyper: vedtak.feiltyper,
  utbedringskostnadNok: vedtak.utbedringskostnadNok,
  bevistyper: vedtak.bevistyper,
  kravtyper: vedtak.kravtyper,
  prinsipaltKrav: vedtak.prinsipaltKrav,
  mangelsgrunnlag: vedtak.mangelsgrunnlag,
  tvistetema: vedtak.tvistetema,
  krevdTotaltNok: vedtak.krevdTotaltNok,
  utfall: vedtak.utfall,
  tilkjentTotaltNok: vedtak.tilkjentTotaltNok,
  enstemmig: vedtak.enstemmig,
  lov: vedtak.lov,
  lovversjon: vedtak.lovversjon,
  paragrafer: vedtak.paragrafer,
  sammendrag: vedtak.sammendrag,
  nokkelmomenter: vedtak.utvalgetsNokkelmomenter,
  sitater: vedtak.sitater,
  konfidens: vedtak.konfidens,
  trengerKontroll: vedtak.trengerKontroll,
  kontrollArsaker: vedtak.kontrollArsaker,
  qaStatus: vedtak.qaStatus,
  qaKommentar: vedtak.qaKommentar,
};

export type VedtakRad = Awaited<ReturnType<typeof kvalitetsutvalg>>[number];

// 30 random decisions, stable for a given seed so the list does not reshuffle after each save.
export async function kvalitetsutvalg(frø: string, antall = 30) {
  return db
    .select(felt)
    .from(vedtak)
    .innerJoin(kildedokument, eq(kildedokument.id, vedtak.kildedokumentId))
    .orderBy(sql`md5(${vedtak.id}::text || ${frø})`)
    .limit(antall);
}

export async function sok(f: Filter, antall = 50) {
  const vilkar: SQL[] = [];
  if (f.kjoretoy) vilkar.push(sql`${vedtak.kjoretoytype} = ${f.kjoretoy}`);
  if (f.feiltype) vilkar.push(sql`${f.feiltype} = any(${vedtak.feiltyper})`);
  if (f.utfall) vilkar.push(sql`${vedtak.utfall} = ${f.utfall}`);
  if (f.ar && /^\d{4}$/.test(f.ar)) vilkar.push(sql`coalesce(extract(year from ${vedtak.vedtaksdato})::int, ${kildedokument.ar}) = ${Number(f.ar)}`);
  if (f.selger) {
    const s = f.selger.trim();
    vilkar.push(/^\d[\d ]{7,}$/.test(s) ? sql`${vedtak.selgerOrgnr} = ${s.replace(/\D/g, "")}` : ilike(vedtak.selgerNavn, `%${s}%`));
  }
  const hvor = vilkar.length ? and(...vilkar) : undefined;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vedtak)
    .innerJoin(kildedokument, eq(kildedokument.id, vedtak.kildedokumentId))
    .where(hvor);
  const treff = await db
    .select(felt)
    .from(vedtak)
    .innerJoin(kildedokument, eq(kildedokument.id, vedtak.kildedokumentId))
    .where(hvor)
    .orderBy(desc(vedtak.vedtaksdato))
    .limit(antall);
  return { n, treff };
}

export async function filterverdier() {
  const ar = await db.execute(sql`select distinct coalesce(extract(year from v.vedtaksdato)::int, k.ar) ar
    from vedtak v join kildedokument k on k.id = v.kildedokument_id order by 1 desc`);
  return { ar: (ar.rows as { ar: number | null }[]).map((r) => r.ar).filter((a): a is number => a != null) };
}
