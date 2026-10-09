// Step 3: won defects that can be compared with the user's, one track at a time (§ 6).
// The search view has no sanction, reservations or the analysis JSON, so they are joined in here.
import { sql } from "drizzle-orm";
import type { HentKandidater, Sanksjon, Spor, VedtakFeil } from "./typer";

export const KANDIDATGRENSE = 30;

// Track A has two kinds (docs/spor.md). The kind is read from the statements, not the legal basis: a
// written statement linked to the defect and weighed for the buyer is a statement even when the
// committee called it withheld information ("oljeforbruk litt høyere enn vanlig" understated, 52074).
const UTTALELSE_FOR_KLAGER = sql`exists (
  select 1 from jsonb_array_elements(a.opplysninger) o
  where o->>'type' = 'uttalelse' and o->>'vekt' = 'for_klager' and o->'gjelder_feil' ? s.feil_id
    and o->>'form' in ('annonse', 'kontrakt', 'melding', 'salgsoppgave', 'tilstandsrapport_fra_selger'))`;
const A_VARIANT = {
  uttalelse: sql`and (s.grunnlag = 'feil_opplysning' or ${UTTALELSE_FOR_KLAGER})`,
  taushet: sql`and s.a_variant in ('taushet', 'begge') and s.grunnlag = 'tilbakeholdt_opplysning'`,
};

export function lagHentKandidater(db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }): HentKandidater {
  return async ({ spor, a_variant, kategori, kategorier, heving_tillatt, tapte = false }) => {
    const variant = spor === "A" && a_variant ? A_VARIANT[a_variant] : sql``;
    // F9: the sanction is read from the decision's conclusion at import (vedtak_analyse.sanksjon).
    const heving = heving_tillatt ? sql`` : sql`and a.sanksjon is distinct from 'heving'`;
    const iKategorier = sql`s.kategori in (${sql.join(kategorier.map((k) => sql`${k}`), sql`, `)})`;
    // Won: a defect found on the track. Lost: a defect tried on the track and not found, and not for
    // reasons the user's form shows they do not share. Both include commission sales: they are judged
    // under the consumer purchase act with joint liability (56288).
    const utvalg = tapte
      ? sql`s.vurdering = 'ikke_mangel' and ${spor} = any(s.spor) and s.selger_type in ('forhandler', 'formidling')
          and coalesce(s.grunn, '') not in ('reklamert_for_sent', 'utbedret_av_selger')`
      : sql`s.vurdering = 'mangel' and ${spor} = any(s.spor_vunnet) ${variant} and s.selger_type in ('forhandler', 'formidling') and s.utfall <> 'avvist' ${heving}`;
    const { rows } = await db.execute(sql`
      select s.vedtak_id, s.feil_id, s.saksnummer, s.vedtaksdato::text as vedtaksdato, s.kilde_url, s.utfall::text as utfall, s.grunn, s.selger_type::text as selger_type,
        s.kategori, s.komponenter, s.grunnlag, s.spor_vunnet, s.a_variant, s.alvor, s.dager_etter_levering,
        s.lovversjon::text as lovversjon, s.alder_ved_kjop, s.km_ved_kjop, s.kjopesum_nok,
        s.belop_tilkjent_nok, v.tilkjent_totalt_nok, v.utbedringskostnad_nok, a.sanksjon, coalesce(v.forbehold, '{}') as forbehold,
        -- The reservation's own words, when tolk's summary has them and the decision does too.
        case when v.forbehold_tekst ~* 'som den står' and v.fulltekst_renset ~* 'som den står' then 'som den står'
             when v.forbehold_tekst ~* 'som den er' and v.fulltekst_renset ~* 'som den er' then 'som den er' end as forbehold_frase,
        (select count(*) from vedtak_feil m where m.vedtak_id = s.vedtak_id
           and (m.vurdering = 'mangel' or (m.vurdering = 'samlet_vurdering' and m.samlet_utfall = 'mangel'))) as antall_mangler, coalesce(v.overtakelsesdato, v.kjopsdato)::text as start_dato,
        a.selger_bevis_finnes, a.forste_henvendelse_dato::text as forste_henvendelse_dato,
        jsonb_array_length(a.feil) as antall_feil, a.opplysninger, a.bevis,
        -- The characters after each quote in the full text, so a quote stored without its full stop
        -- is still known to end a sentence, and one cut short by the agent is not.
        -- The full text is normalised once per decision, not once per quote (that was 0.8 s of 0.85 s).
        (select coalesce(jsonb_agg(b || jsonb_build_object('neste_tegn',
            case when strpos(t.n, q.q) > 0 then substr(t.n, strpos(t.n, q.q) + length(q.q), 3) end)), '[]'::jsonb)
         from (select regexp_replace(v.fulltekst_renset, '[[:space:]]+', ' ', 'g') as n offset 0) t,
              jsonb_array_elements(a.begrunnelse_sitater) b,
              lateral (select regexp_replace(trim(b->>'tekst'), '[[:space:]]+', ' ', 'g') as q) q) as begrunnelse_sitater
      from vedtak_feil_sok s
      join vedtak v on v.id = s.vedtak_id
      join vedtak_analyse a on a.vedtak_id = s.vedtak_id
      where ${utvalg}
        and ${iKategorier}
        and s.vedtaksdato >= date '2021-01-01'
        and not s.ikke_mangelssak
      order by (s.kategori = ${kategori}) desc, s.vedtaksdato desc, s.vedtak_id, s.feil_id
      limit ${KANDIDATGRENSE}`);
    return rows.map((r) => tilVedtakFeil(r, spor));
  };
}

function tilVedtakFeil(r: Record<string, unknown>, spor: Spor): VedtakFeil {
  const n = (x: unknown) => (x == null ? null : Number(x));
  return {
    vedtak_id: Number(r.vedtak_id),
    feil_id: String(r.feil_id),
    spor,
    saksnummer: String(r.saksnummer),
    vedtaksdato: String(r.vedtaksdato),
    kilde_url: String(r.kilde_url),
    utfall: String(r.utfall),
    grunn: (r.grunn as string) ?? null,
    selger_type: String(r.selger_type),
    kategori: String(r.kategori),
    komponenter: (r.komponenter as string[]) ?? [],
    grunnlag: (r.grunnlag as string) ?? null,
    spor_vunnet: r.spor_vunnet as Spor[],
    a_variant: (r.a_variant as string) ?? null,
    alvor: (r.alvor as string[]) ?? [],
    dager_etter_levering: n(r.dager_etter_levering),
    lovversjon: String(r.lovversjon),
    alder_ved_kjop: n(r.alder_ved_kjop),
    km_ved_kjop: n(r.km_ved_kjop),
    kjopesum_nok: n(r.kjopesum_nok),
    tilkjent_totalt_nok: n(r.tilkjent_totalt_nok),
    utbedringskostnad_nok: n(r.utbedringskostnad_nok),
    belop_tilkjent_nok: n(r.belop_tilkjent_nok),
    antall_mangler: Number(r.antall_mangler),
    sanksjon: (r.sanksjon as Sanksjon) ?? null,
    selger_bevis_finnes: Boolean(r.selger_bevis_finnes),
    forbehold: r.forbehold as string[],
    forbehold_frase: (r.forbehold_frase as VedtakFeil["forbehold_frase"]) ?? null,
    forste_henvendelse_dato: (r.forste_henvendelse_dato as string) ?? null,
    start_dato: (r.start_dato as string) ?? null,
    antall_feil: Number(r.antall_feil),
    opplysninger: r.opplysninger as VedtakFeil["opplysninger"],
    bevis: r.bevis as VedtakFeil["bevis"],
    begrunnelse_sitater: r.begrunnelse_sitater as VedtakFeil["begrunnelse_sitater"],
  };
}
