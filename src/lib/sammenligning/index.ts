// The comparison engine: the user's form in, per defect the best won decision the case is at least as
// strong as, and the finished practice paragraph out (docs/sammenligningsmotor.md). Deterministic.
import { byggArgumenter, kmSvakhetIAvsnitt, lovendring, renderAvsnitt, velgSitat } from "./argumenter";
import { SKJEMA_VERSJON } from "@/lib/skjema/skjema";
import { avledFeil, avledSak, gruppenUtenom } from "./avled";
import { tall } from "./fraser";
import { velgOpplysning, vurderKriterier } from "./kriterier";
import { fordel, ranger, sterkereEnn, velgTilBrev } from "./ranger";
import type { FeilProfil, FeilResultat, Forkastet, HentKandidater, KandidatRef, Kriterium, Motstridende, Naermeste, Resultat, Sak, SakProfil, Skjema, Spor, VedtakFeil, Vurdert } from "./typer";

export type { Resultat, Skjema } from "./typer";

const SAK_FELT: (keyof SakProfil)[] = [
  "lov",
  "formodningsfrist_dager",
  "alder_ved_kjop",
  "prisband",
  "aldersband",
  "kmband",
  "km_siden_kjop",
  "mnd_siden_kjop",
  "km_per_mnd",
  "svakhet_sak",
  "selger_motbevis",
  "forlik",
  "onsket_losning",
  "heving_tillatt_i_praksis",
];
const sakProfil = (s: Sak) => Object.fromEntries(SAK_FELT.map((k) => [k, s[k]])) as SakProfil;

// A rejected decision with what the user lacks against it, kept for the nearest-decision answer.
type Naer = { vedtak: VedtakFeil; mangler: string[] };
type Vurdering = { godkjente: Vurdert[]; forkastede: Forkastet[]; naer: Naer[]; antall: number };

const hentSpor = (sak: Sak, f: FeilProfil, spor: Spor, hent: HentKandidater, kategorier: string[], tapte = false) =>
  hent({ spor, a_variant: spor === "A" ? f.a_variant : null, kategori: f.kategori_pass2, kategorier, heving_tillatt: sak.heving_tillatt_i_praksis, tapte });

function mangler(sak: Sak, f: FeilProfil, v: VedtakFeil, kriterier: Kriterium[]): string[] {
  const ut = kriterier.filter((k) => k.utfall === "svakere").map((k) => k.navn);
  if (v.spor !== "A" && sak.selger_motbevis && !v.selger_bevis_finnes && !ut.includes("selger_motbevis")) ut.push("selger_motbevis");
  // B needs written documentation of the defect (avled.ts); a decision on B always had it.
  if (v.spor === "B" && !f.rapport_ok) ut.unshift("rapport_ok");
  return ut;
}

// The category first; on A the rest of the information group only when nothing in the category was
// approved. Two queries, so 30 rejected hits in the category cannot hide the group.
async function vurderSpor(sak: Sak, f: FeilProfil, spor: Spor, hent: HentKandidater): Promise<Vurdering> {
  const forste = vurderKandidater(sak, f, spor, await hentSpor(sak, f, spor, hent, [f.kategori_pass2]));
  const gruppe = spor === "A" ? gruppenUtenom(f.kategori_pass2) : [];
  if (forste.godkjente.length || !gruppe.length) return forste;
  const andre = vurderKandidater(sak, f, spor, await hentSpor(sak, f, spor, hent, gruppe));
  return { godkjente: andre.godkjente, forkastede: [...forste.forkastede, ...andre.forkastede], naer: [...forste.naer, ...andre.naer], antall: forste.antall + andre.antall };
}

function vurderKandidater(sak: Sak, f: FeilProfil, spor: Spor, kandidater: VedtakFeil[]): Vurdering {
  const godkjente: Vurdert[] = [];
  const forkastede: Forkastet[] = [];
  const naer: Naer[] = [];
  for (const v of kandidater) {
    const opplysning = spor === "A" && f.a_variant ? velgOpplysning(v, f.a_variant) : null;
    const kriterier = vurderKriterier(sak, f, v, opplysning);
    const dom = sterkereEnn(kriterier, sak, v);
    if (!dom.godkjent) {
      forkastede.push({ saksnummer: `${v.saksnummer} ${v.feil_id}`, grunn: dom.grunn });
      if (kriterier.length) naer.push({ vedtak: v, mangler: mangler(sak, f, v, kriterier) });
      continue;
    }
    godkjente.push({ vedtak: v, opplysning, kriterier, antall_sterkere: kriterier.filter((k) => k.utfall === "sterkere").length, svakhet: dom.svakhet });
  }
  return { godkjente: ranger(godkjente, f, sak), forkastede, naer, antall: kandidater.length };
}

// Tracks a better report could open, beyond those the defect has: C always, B inside the period.
// A cannot be added afterwards: the seller's statement is what it is.
const sporMedRapport = (f: FeilProfil): Spor[] => (["C", ...(f.innen_frist ? ["B" as const] : [])] as Spor[]).filter((s) => !f.spor_alle.includes(s));

// What a written report can supply; the rest (age, price, the seller's evidence …) no report changes.
export const RAPPORT_KAN_GI = ["rapport_ok", "arsak", "utover_paregnelig", "ved_levering", "rapport_levering", "dokumentert_fortielse"];
const utenforRapport = (x: Naer) => x.mangler.filter((m) => !RAPPORT_KAN_GI.includes(m)).length;

// The same kind of defect first (it is the analogy the report order rests on), then fewest gaps a
// report cannot close, then fewest gaps.
function naermeste(f: FeilProfil, naer: Naer[]): Naermeste | null {
  const x = [...naer].sort(
    (a, b) =>
      Number(b.vedtak.kategori === f.kategori_pass2) - Number(a.vedtak.kategori === f.kategori_pass2) ||
      utenforRapport(a) - utenforRapport(b) ||
      a.mangler.length - b.mangler.length ||
      b.vedtak.vedtaksdato.localeCompare(a.vedtak.vedtaksdato) ||
      a.vedtak.vedtak_id - b.vedtak.vedtak_id ||
      a.vedtak.feil_id.localeCompare(b.vedtak.feil_id),
  )[0];
  if (!x) return null;
  const v = x.vedtak;
  return { saksnummer: v.saksnummer, vedtaksdato: v.vedtaksdato, kilde_url: v.kilde_url, kategori: v.kategori, spor: v.spor, sanksjon: v.sanksjon, tilkjent_totalt_nok: v.tilkjent_totalt_nok, mangler: x.mangler };
}

function kandidatRef(x: Vurdert): KandidatRef {
  const v = x.vedtak;
  const o = x.opplysning;
  return {
    vedtak_id: v.vedtak_id,
    saksnummer: v.saksnummer,
    vedtaksdato: v.vedtaksdato,
    kilde_url: v.kilde_url,
    feil_id: v.feil_id,
    kategori: v.kategori,
    spor_vunnet: v.spor_vunnet,
    a_variant: v.a_variant,
    lovversjon: v.lovversjon,
    sanksjon: v.sanksjon,
    tilkjent_totalt_nok: v.tilkjent_totalt_nok,
    opplysning: o ? { form: o.form, rekkevidde: o.rekkevidde, ordlyd: o.ordlyd_verifisert ? o.ordlyd : null, svar_pa_direkte_sporsmal: o.svar_pa_direkte_sporsmal } : null,
    forbehold: v.forbehold.length > 0,
    dager_etter_levering: v.dager_etter_levering,
    selger_bevis_finnes: v.selger_bevis_finnes,
  };
}

// The «similar facts»: degree, not kind. A loss counts against the user when the user is stronger on
// none of the other criteria, nor on the seller's evidence. Unlike for won decisions, what the lost
// decision does not say is not «as good»: where the user has something, the loss must be known to have it.
const GRAD = ["tid_til_feil", "reklamasjonstid", "alder", "km", "pris", "kostnad_pris", "alvor", "kategori"];

const GRUNN: Record<string, string> = {
  paregnelig_slitasje: "la utvalget til grunn at feilen var vanlig slitasje for bilens alder og kjørelengde",
  ikke_dokumentert: "mente utvalget at feilen ikke var dokumentert",
  ikke_sannsynliggjort_ved_levering: "mente utvalget at det ikke var sannsynliggjort at feilen var der ved leveringen",
  kjent_eller_opplyst: "var feilen kjent for kjøperen eller opplyst av selger",
  synlig_ved_besiktigelse: "kunne feilen ses ved besiktigelse",
  oppstatt_etter_levering: "mente utvalget at feilen oppsto etter leveringen",
  forbehold: "la utvalget vekt på forbeholdet i kontrakten",
};

// A loss for want of something the user's report has, is no loss on the user's facts. Grounds the
// form cannot answer (known to the buyer, visible on inspection, «annet») always count.
const BESVART: Record<string, (sak: Sak, f: FeilProfil) => boolean> = {
  paregnelig_slitasje: (_, f) => f.rapport_paregnelig,
  ikke_dokumentert: (_, f) => f.rapport_ok,
  ikke_sannsynliggjort_ved_levering: (_, f) => f.rapport_levering,
  oppstatt_etter_levering: (_, f) => f.rapport_levering,
  forbehold: (sak) => sak.uten_forbehold === true,
};

function skilte(vunnet: VedtakFeil, tapt: VedtakFeil): string[] {
  const x = vunnet.saksnummer;
  const y = tapt.saksnummer;
  const ut = tapt.grunn && GRUNN[tapt.grunn] ? [`I ${y} ${GRUNN[tapt.grunn]}.`] : [];
  const ulik = (a: number | null, b: number | null, terskel: (a: number, b: number) => boolean): a is number => a != null && b != null && terskel(a, b);
  if (ulik(tapt.km_ved_kjop, vunnet.km_ved_kjop, (a, b) => Math.max(a, b) >= 1.25 * Math.min(a, b)))
    ut.push(`Bilen i ${y} hadde gått ${tall(tapt.km_ved_kjop)} km, mot ${tall(vunnet.km_ved_kjop!)} km i ${x}.`);
  if (ulik(tapt.alder_ved_kjop, vunnet.alder_ved_kjop, (a, b) => Math.abs(a - b) >= 2)) ut.push(`Bilen i ${y} var ${tapt.alder_ved_kjop} år, mot ${vunnet.alder_ved_kjop} år i ${x}.`);
  if (ulik(tapt.dager_etter_levering, vunnet.dager_etter_levering, (a, b) => Math.abs(a - b) >= 30))
    ut.push(`Feilen i ${y} viste seg etter ${tapt.dager_etter_levering} dager, mot ${vunnet.dager_etter_levering} dager i ${x}.`);
  return ut;
}

function motstridende(sak: Sak, f: FeilProfil, vunnet: VedtakFeil, tapte: VedtakFeil[]): Motstridende | null {
  const treff = tapte
    .filter((v) => !(v.grunn && BESVART[v.grunn]?.(sak, f)))
    .map((v) => {
      const o = v.spor === "A" && f.a_variant ? velgOpplysning(v, f.a_variant) : null;
      const kriterier = vurderKriterier(sak, f, v, o);
      const sterkere = kriterier.filter((k) => k.utfall === "sterkere");
      const ukjent = kriterier.filter((k) => k.vedtak == null && k.bruker != null && k.bruker !== false);
      const brukerSterkest = [...sterkere, ...ukjent].some((k) => !GRAD.includes(k.navn)) || (v.spor !== "A" && !sak.selger_motbevis && v.selger_bevis_finnes);
      // The most similar loss, not the one strongest against the user: fewest criteria that differ
      // either way, then the closest car (a year ~ 25 000 km).
      const ulike = kriterier.filter((k) => k.navn !== "kategori" && (k.utfall === "sterkere" || k.utfall === "svakere")).length;
      const bil = Math.abs((v.alder_ved_kjop ?? 99) - sak.alder_ved_kjop) + Math.abs((v.km_ved_kjop ?? 9e6) - sak.km_ved_kjop) / 25_000;
      return kriterier.length && !brukerSterkest ? { v, ulike, bil } : null;
    })
    .filter((x) => x != null)
    .sort((a, b) => a.ulike - b.ulike || a.bil - b.bil || b.v.vedtaksdato.localeCompare(a.v.vedtaksdato) || a.v.vedtak_id - b.v.vedtak_id)[0];
  if (!treff) return null;
  const v = treff.v;
  return { saksnummer: v.saksnummer, vedtaksdato: v.vedtaksdato, kilde_url: v.kilde_url, grunn: v.grunn, skilte: skilte(vunnet, v) };
}

export async function sammenlign(skjema: Skjema, hent: HentKandidater, idag = new Date().toISOString().slice(0, 10)): Promise<Resultat> {
  // The engine reads one version of the form; an unknown one is refused (docs/skjema.md § 4).
  if (skjema._meta?.skjema_versjon !== SKJEMA_VERSJON) throw new Error(`Ukjent skjemaversjon: ${skjema._meta?.skjema_versjon ?? "mangler"}`);
  const sak = avledSak(skjema, idag);
  if (skjema.del1_kjopet.selgertype === "privat") return { stopp: "privat_selger", sak: sakProfil(sak), feil: [], valgt_til_brev: [], lovendring: null, ingen_treff: [] };

  const profiler = skjema.del3_feil.map((f) => avledFeil(sak, f));
  // A settled defect is not claimed (110357): it is not matched, so it can never take a decision from
  // a defect that goes into the letter.
  const aktive = profiler.filter((f) => !f.forlik);
  // Primary track first; the secondary only when the primary leaves the defect without a decision (§ 6),
  // either because nothing was approved or because another defect took what was.
  const vurderinger = new Map<string, { primar: Vurdering | null; sekundar: Vurdering | null }>();
  const primare = await Promise.all(aktive.map((f) => (f.spor_primar ? vurderSpor(sak, f, f.spor_primar, hent) : null)));
  profiler.forEach((f) => vurderinger.set(f.feil_id, { primar: null, sekundar: null }));
  aktive.forEach((f, i) => (vurderinger.get(f.feil_id)!.primar = primare[i]));
  const lister = () =>
    new Map(aktive.map((f) => [f.feil_id, [...(vurderinger.get(f.feil_id)!.primar?.godkjente ?? []), ...(vurderinger.get(f.feil_id)!.sekundar?.godkjente ?? [])]]));
  const kostnader = new Map(aktive.map((f) => [f.feil_id, f.kostnad_kr ?? 0]));
  let valgt = fordel(lister(), kostnader);
  const mangler = aktive.filter((f) => !valgt.get(f.feil_id) && f.spor_sekundar);
  const sekundare = await Promise.all(mangler.map((f) => vurderSpor(sak, f, f.spor_sekundar!, hent)));
  mangler.forEach((f, i) => (vurderinger.get(f.feil_id)!.sekundar = sekundare[i]));
  if (mangler.length) valgt = fordel(lister(), kostnader);
  const godkjenteListe = lister();
  // A defect left without a decision gets the nearest won one, also on the tracks a report would open.
  const utenVedtak = aktive.filter((f) => !valgt.get(f.feil_id));
  const ekstra = await Promise.all(utenVedtak.map((f) => Promise.all(sporMedRapport(f).map((s) => vurderSpor(sak, f, s, hent)))));
  const naerListe = new Map(
    utenVedtak.map((f, i) => {
      const { primar, sekundar } = vurderinger.get(f.feil_id)!;
      return [f.feil_id, [primar, sekundar, ...ekstra[i]].flatMap((x) => x?.naer ?? [])];
    }),
  );
  const tilBrev = velgTilBrev(
    aktive.map((f) => ({ feil_id: f.feil_id, kostnad: f.kostnad_kr ?? 0, valgt: valgt.get(f.feil_id) ?? null, kategori: f.kategori_pass2 })),
  );
  // A lost case on the same track and kind of defect, as strong as the user's, lowers the strength.
  const medVedtak = aktive.filter((f) => valgt.get(f.feil_id));
  const tapte = await Promise.all(medVedtak.map((f) => hentSpor(sak, f, valgt.get(f.feil_id)!.vedtak.spor, hent, [f.kategori_pass2], true)));
  const mot = new Map(medVedtak.map((f, i) => [f.feil_id, motstridende(sak, f, valgt.get(f.feil_id)!.vedtak, tapte[i])]));

  const ingenTreff: Resultat["ingen_treff"] = [];
  const feil = profiler.map((f): FeilResultat => {
    const { primar, sekundar } = vurderinger.get(f.feil_id)!;
    const x = valgt.get(f.feil_id) ?? null;
    const forkastede = [...(primar?.forkastede ?? []), ...(sekundar?.forkastede ?? [])];
    // A won decision another defect took is not lost, only used elsewhere.
    for (const g of godkjenteListe.get(f.feil_id) ?? []) {
      if (g === x) break;
      const annen = [...valgt.entries()].find(([id, y]) => id !== f.feil_id && y?.vedtak.vedtak_id === g.vedtak.vedtak_id);
      if (annen) forkastede.push({ saksnummer: `${g.vedtak.saksnummer} ${g.vedtak.feil_id}`, grunn: `vedtaket brukes for ${annen[0]}` });
    }
    if (!x) {
      const stopp = f.forlik
        ? "forlik: ikke vurdert"
        : !f.spor_primar
        ? `ingen_spor: ${f.ingen_spor_arsak}`
        : !(primar?.antall || sekundar?.antall)
          ? `ingen kandidater på spor ${f.spor_alle.slice(0, 2).join("/")}`
          : `alle ${(primar?.antall ?? 0) + (sekundar?.antall ?? 0)} kandidater forkastet`;
      ingenTreff.push({ feil_id: f.feil_id, siste_stopp: stopp });
    }
    const argumenter = x ? byggArgumenter(sak, f, x) : [];
    const sitat = x ? velgSitat(x.vedtak) : null;
    return {
      feil_id: f.feil_id,
      kategori_skjema: f.kategori_skjema,
      kategori_pass2: f.kategori_pass2,
      dager_til_feil: f.dager_til_feil,
      innen_frist: f.innen_frist,
      slitedel: f.slitedel,
      spor_primar: f.spor_primar,
      a_variant: f.a_variant,
      spor_sekundar: f.spor_sekundar,
      spor_alle: f.spor_alle,
      ingen_spor_arsak: f.ingen_spor_arsak,
      kan_bilen_brukes: f.kan_bilen_brukes,
      alvor: f.alvor,
      km_svakhet_i_avsnitt: x != null && kmSvakhetIAvsnitt(sak, f),
      kandidat: x ? kandidatRef(x) : null,
      kandidat_spor: x?.vedtak.spor ?? null,
      kriterier: (x?.kriterier ?? []).map(({ navn, bruker, vedtak, utfall }) => ({ navn, bruker, vedtak, utfall })),
      antall_sterkere: x?.antall_sterkere ?? 0,
      svakhet_adressert: x?.svakhet?.navn ?? null,
      godkjent: x != null,
      sitat,
      argumenter,
      // Rendered for every approved defect so it can be checked; the letter only uses those in valgt_til_brev.
      avsnitt: x ? renderAvsnitt(f, x, argumenter, sitat) : null,
      forkastede,
      styrke: f.forlik ? null : !x ? "svak" : mot.get(f.feil_id) ? "middels" : "sterk",
      motstridende: mot.get(f.feil_id) ?? null,
      naermeste: x ? null : naermeste(f, naerListe.get(f.feil_id) ?? []),
      forlik: f.forlik,
      reklamasjon_over_to_mnd: f.dager_til_reklamasjon == null ? null : f.dager_til_reklamasjon > 60,
    };
  });

  const sitert = tilBrev.map((id) => valgt.get(id)!.vedtak);
  return { stopp: null, sak: sakProfil(sak), feil, valgt_til_brev: tilBrev, lovendring: lovendring(sak, sitert), ingen_treff: ingenTreff };
}
