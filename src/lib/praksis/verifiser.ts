// The deterministic check of the model's paragraph (docs/praksis.md). A pure function of the model's
// answer and what the filter, the form and the decision's full text say. Every sentence about a decision
// must carry a verbatim belegg from it; numbers about the decision come from the database; a sentence
// that breaks a rule is struck, and more than one struck sentence means no paragraph.
import { fulltekstVarianter, normaliser } from "@/lib/analyse/verifiser";
import type { FeilProfil, Sak, VedtakFeil, Vurdert } from "@/lib/sammenligning/typer";
import type { SkjemaFeil } from "@/lib/skjema/skjema";
import { harPersonopplysning, type Kjent } from "./rens";
import { datoerI, datoLang, helSetning, indreAnforsel, MOT_KJOPER, PARAGRAF, tall, tallI, VURDERING_START } from "./tekst";
import type { Belegg, Modus, PraksisSvar, Setning, StrykRegel, Verifisert } from "./typer";

export const MIN_BELEGG = 20;
export const MAKS_STRYKNINGER = 1;
// Periods and figures a sentence may give without a source: two years, five years, six months, 24 months,
// the presumption periods in days, the year of the amendment.
const FASTE_TALL = [1, 2, 5, 6, 24, 183, 730, 2024];
// A general paragraph describes the rule; it never claims the buyer's case is like or stronger than one.
const SAMMENLIGNING = /like sterk|sterkere|samme type|tilsvarende sak|i (?:sak|vedtak)\s+\S+\s+fikk/i;
const LIKE_STERKT = /(?<!minst\s)like sterk/i;
const PLASSHOLDER = /\{\{(\w+)\}\}/g;
const ELLIPSE = /…|\.\.\./;

export type Grunnlag = {
  modus: Modus;
  kandidater: Vurdert[];
  fulltekst: Map<number, string>;
  sak: Sak;
  feil: FeilProfil;
  skjemaFeil: SkjemaFeil;
  km_na: number;
  kjente: Kjent[];
};

type Tekst = { varianter: string[]; vurderingFra: number[] };

function lagTekst(fulltekst: string): Tekst {
  const varianter = fulltekstVarianter(fulltekst);
  return { varianter, vurderingFra: varianter.map((v) => v.search(VURDERING_START)) };
}

// Where the passage stands in the full text, or null when it is not there verbatim. Whether it stands in
// the committee's own assessment (after «Utvalget ser slik på saken»).
function finn(passasje: string, t: Tekst): { iVurdering: boolean } | null {
  const p = normaliser(passasje);
  if (p.length < MIN_BELEGG || ELLIPSE.test(p)) return null;
  let funnet = false;
  let iVurdering = false;
  t.varianter.forEach((v, i) => {
    const pos = v.indexOf(p);
    if (pos < 0) return;
    funnet = true;
    iVurdering ||= t.vurderingFra[i] >= 0 && pos >= t.vurderingFra[i];
  });
  return funnet ? { iVurdering } : null;
}

const datoDeler = (d: (string | null | undefined)[]) => d.filter((x): x is string => !!x).flatMap((x) => x.split("-").map(Number));
const prosenter = (andel: number) => [Math.round(andel * 100), Math.round(andel * 1000) / 10];

function tillattForVedtak(v: VedtakFeil, belegg: Belegg | null) {
  const datoer = [v.vedtaksdato, v.start_dato, v.forste_henvendelse_dato, ...(belegg ? datoerI(belegg.sitat) : [])].filter((x): x is string => !!x);
  const tall = [v.kjopesum_nok, v.km_ved_kjop, v.alder_ved_kjop, v.tilkjent_totalt_nok, v.belop_tilkjent_nok, v.dager_etter_levering, ...(belegg ? tallI(belegg.sitat) : []), ...datoDeler(datoer)];
  return { datoer, tall: tall.filter((x): x is number => x != null) };
}

function tillattForMinSak(g: Grunnlag) {
  const { sak, feil, skjemaFeil: f } = g;
  const tekster = [f.avskrift_selger, f.avskrift_verksted, f.en_setning].filter((x): x is string => !!x);
  const datoer = [sak.kjopsdato, f.dato_oppdaget, sak.dato_forste_gang, ...tekster.flatMap(datoerI)].filter((x): x is string => !!x);
  const andel = feil.kostnad_kr != null && (feil.kostnad_kr <= sak.pris_kr || feil.kostnad_over_pris_bekreftet) ? prosenter(feil.kostnad_kr / sak.pris_kr) : [];
  const tall = [sak.pris_kr, sak.km_ved_kjop, g.km_na, Number(sak.kjopsdato.slice(0, 4)) - sak.alder_ved_kjop, sak.alder_ved_kjop, sak.km_siden_kjop, sak.mnd_siden_kjop, feil.dager_til_feil, feil.dager_til_reklamasjon, feil.kostnad_kr, ...andel, ...tekster.flatMap(tallI), ...datoDeler(datoer)];
  return { datoer, tall: tall.filter((x): x is number => x != null) };
}

export function verifiserPraksis(svar: PraksisSvar, g: Grunnlag): Verifisert {
  const ut: Verifisert = { modus: g.modus, avsnitt: null, vedtak_id: null, eksempel_vedtak_ids: [], grunn: null, strykninger: [] };
  const ingen = (grunn: string): Verifisert => ({ ...ut, grunn });
  const kandidat = new Map(g.kandidater.map((x) => [x.vedtak.vedtak_id, x]));
  const tekster = new Map<number, Tekst>();
  const tekst = (id: number) => {
    if (!tekster.has(id) && g.fulltekst.has(id)) tekster.set(id, lagTekst(g.fulltekst.get(id)!));
    return tekster.get(id) ?? null;
  };

  // Which decisions the paragraph may draw on.
  let valgt: Vurdert | null = null;
  if (g.modus === "spesifikk") {
    if (svar.valgt_vedtak_id == null) return ingen(`modellen fant ikke et sammenlignbart vedtak: ${svar.grunn_ingen ?? "uten grunn"}`);
    valgt = kandidat.get(svar.valgt_vedtak_id) ?? null;
    if (!valgt) return ingen(`vedtak ${svar.valgt_vedtak_id} er ikke blant kandidatene`);
    if (!tekst(valgt.vedtak.vedtak_id)) return ingen("vedtaket mangler fulltekst");
  } else {
    if (svar.valgt_vedtak_id != null) return ingen("et generelt avsnitt viser ikke til ett vedtak");
    if (svar.eksempel_vedtak_ids.some((id) => !kandidat.has(id))) return ingen("eksempel utenfor juristens eksempler");
  }
  const lovlig = (id: number) => (valgt ? id === valgt.vedtak.vedtak_id : kandidat.has(id));

  // The quote (ledd 3): a whole sentence from the committee's own assessment. Required for a specific paragraph.
  let sitat: { vedtak: VedtakFeil; tekst: string } | null = null;
  if (svar.sitat) {
    const s = svar.sitat;
    const t = lovlig(s.vedtak_id) ? tekst(s.vedtak_id) : null;
    const funnet = t ? finn(s.tekst, t) : null;
    const feil = !t
      ? "fra et vedtak avsnittet ikke kan vise til"
      : !funnet
        ? "står ikke ordrett i vedtaket"
        : !funnet.iVurdering
          ? "står ikke i utvalgets vurdering"
          : !helSetning(s.tekst)
            ? "er ikke en hel setning"
            : MOT_KJOPER.test(s.tekst)
              ? "kan snus mot kjøperen"
              : harPersonopplysning(s.tekst, g.kjente)
                ? "inneholder en personopplysning"
                : null;
    if (feil && g.modus === "spesifikk") return ingen(`sitatet ${feil}`);
    if (feil) ut.strykninger.push({ tekst: s.tekst, regel: "belegg", detalj: `sitatet ${feil}` });
    else sitat = { vedtak: kandidat.get(s.vedtak_id)!.vedtak, tekst: s.tekst };
  } else if (g.modus === "spesifikk") return ingen("sitatet mangler");

  const minSak = tillattForMinSak(g);
  const beholdt: Array<{ ledd: number; tekst: string; vedtak: number | null }> = [];
  for (const s of svar.setninger) {
    const r = sjekk(s, g, valgt, kandidat, tekst, lovlig, minSak);
    if ("regel" in r) ut.strykninger.push({ tekst: s.tekst, regel: r.regel, detalj: r.detalj });
    else beholdt.push(r);
  }
  if (ut.strykninger.length > MAKS_STRYKNINGER) return { ...ut, grunn: `${ut.strykninger.length} setninger strøket` };
  if (!beholdt.some((s) => s.ledd === 1)) return { ...ut, grunn: "ledd 1 mangler" };

  const avslutt = (t: string) => (/[.!?»]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const sitatSetning = sitat
    ? g.modus === "spesifikk"
      ? `Utvalget uttalte: «${indreAnforsel(sitat.tekst.trim().replace(/[.\s]+$/, ""))}».`
      : `I sak ${sitat.vedtak.saksnummer} uttalte utvalget: «${indreAnforsel(sitat.tekst.trim().replace(/[.\s]+$/, ""))}».`
    : null;
  const iLedd = (n: number) => beholdt.filter((s) => s.ledd === n).map((s) => avslutt(s.tekst));
  const deler = g.modus === "spesifikk" ? [...iLedd(1), ...iLedd(2), sitatSetning, ...iLedd(4), ...iLedd(5)] : [...iLedd(1), ...iLedd(2), sitatSetning];
  const eksempler = g.modus === "generell" ? [...new Set([...beholdt.map((s) => s.vedtak), sitat?.vedtak.vedtak_id ?? null].filter((x): x is number => x != null))] : [];
  return {
    ...ut,
    avsnitt: deler.filter((x): x is string => !!x).join(" ").replace(/\s+/g, " "),
    vedtak_id: valgt?.vedtak.vedtak_id ?? null,
    eksempel_vedtak_ids: eksempler,
  };
}

type Sjekket = { ledd: number; tekst: string; vedtak: number | null } | { regel: StrykRegel; detalj: string };

function sjekk(
  s: Setning,
  g: Grunnlag,
  valgt: Vurdert | null,
  kandidat: Map<number, Vurdert>,
  tekst: (id: number) => Tekst | null,
  lovlig: (id: number) => boolean,
  minSak: { datoer: string[]; tall: number[] },
): Sjekket {
  const stryk = (regel: StrykRegel, detalj: string): Sjekket => ({ regel, detalj });
  const tillatteLedd = g.modus === "spesifikk" ? [1, 2, 4, 5] : [1, 2];
  if (!s.tekst.trim() || !tillatteLedd.includes(s.ledd)) return stryk("ledd", `ledd ${s.ledd} er ikke tillatt i et ${g.modus} avsnitt`);
  // A lead-in such as «Utvalget uttalte:» is not a sentence; the quote has its own field.
  if (/:\s*$/.test(s.tekst) || s.tekst.trim().split(/\s+/).length < 4) return stryk("ledd", "ikke en hel setning");

  // A sentence about the decision needs a verbatim belegg from it; what the committee found (ledd 1),
  // from its own assessment.
  const omVedtak = s.om !== "min_sak";
  const b = omVedtak ? s.belegg : null;
  let v: VedtakFeil | null = null;
  if (omVedtak) {
    if (!b || !lovlig(b.vedtak_id)) return stryk("belegg", b ? `belegg fra vedtak ${b.vedtak_id}, som avsnittet ikke kan vise til` : "setningen om vedtaket mangler belegg");
    const t = tekst(b.vedtak_id);
    const funnet = t ? finn(b.sitat, t) : null;
    if (!funnet) return stryk("belegg", "belegget står ikke ordrett i vedtaket");
    if (s.ledd === 1 && !funnet.iVurdering) return stryk("vurderingsdel", "ledd 1 må ha belegg fra utvalgets vurdering");
    v = kandidat.get(b.vedtak_id)!.vedtak;
  }

  // Placeholders: the decision's number, date and amount come from the database, never from the model.
  let utfylt = s.tekst;
  for (const m of s.tekst.matchAll(PLASSHOLDER)) {
    const navn = m[1];
    if (!v) return stryk("plassholder", `{{${navn}}} i en setning om min sak`);
    const belop = v.belop_tilkjent_nok ?? v.tilkjent_totalt_nok;
    let verdi: string | null = null;
    if (navn === "saksnummer") verdi = v.saksnummer;
    else if (navn === "vedtaksdato") verdi = datoLang(v.vedtaksdato);
    else if (navn === "belop" && g.modus === "spesifikk" && belop != null) {
      if (!tallI(b!.sitat).includes(belop)) return stryk("belegg", `beløpet ${tall(belop)} kr står ikke i belegget`);
      verdi = tall(belop);
    }
    if (verdi == null) return stryk("plassholder", `{{${navn}}} kan ikke fylles ut`);
    utfylt = utfylt.replace(m[0], verdi);
  }
  const uten = s.tekst.replace(PLASSHOLDER, " ");

  // Dates, section numbers and figures: from the decision (its row and the belegg) or the form.
  const vedtak = v ? tillattForVedtak(v, b) : { datoer: [], tall: [] };
  const datoer = new Set(["2024-01-01", ...(s.om !== "vedtak" ? minSak.datoer : []), ...(omVedtak ? vedtak.datoer : [])]);
  const fremmedDato = datoerI(uten).find((d) => !datoer.has(d));
  if (fremmedDato) return stryk("dato", `datoen ${fremmedDato} står ikke i kildene`);
  for (const m of uten.matchAll(PARAGRAF)) if (!b || !new RegExp(`§§?\\s*${m[1]}(?!\\d)`).test(b.sitat)) return stryk("paragraf", `§ ${m[1]} står ikke i belegget`);
  const tallene = new Set([...FASTE_TALL, ...(s.om !== "vedtak" ? minSak.tall : []), ...(omVedtak ? vedtak.tall : [])]);
  const fremmedTall = tallI(uten.replace(PARAGRAF, " ")).find((n) => !tallene.has(n));
  if (fremmedTall != null) return stryk("tall", `tallet ${fremmedTall} står ikke i kildene`);

  if (omVedtak && MOT_KJOPER.test(utfylt)) return stryk("ord", "ord som kan snus mot kjøperen");
  if (g.modus === "generell" && SAMMENLIGNING.test(utfylt)) return stryk("sammenligning", "et generelt avsnitt sammenligner ikke");
  if (g.modus === "spesifikk" && LIKE_STERKT.test(utfylt) && valgt && (valgt.antall_sterkere > 0 || valgt.svakhet))
    return stryk("like_sterkt", "«like sterkt» når kjøperen er sterkere eller har en svakhet");
  if (harPersonopplysning(utfylt, g.kjente)) return stryk("personopplysning", "setningen inneholder en personopplysning");
  return { ledd: s.ledd, tekst: utfylt, vedtak: v?.vedtak_id ?? null };
}

