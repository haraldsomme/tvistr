// The comparison engine as a filter: the user's form in, per defect the strength and up to five won
// decisions in the same category the case is at least as strong as (docs/sammenligningsmotor.md).
// Deterministic and without text: the practice paragraph is written from the candidates in src/lib/praksis.
import { SKJEMA_VERSJON } from "@/lib/skjema/skjema";
import { avledFeil, avledSak } from "./avled";
import { velgOpplysning, vurderKriterier } from "./kriterier";
import { ranger, sterkereEnn, velgTilBrev } from "./ranger";
import type { FeilProfil, FeilResultat, Forkastet, HentKandidater, KandidatRef, Resultat, Sak, SakProfil, Skjema, Spor, StyrkeGrunn, Tapte, VedtakFeil, Vurdert } from "./typer";

export type { Resultat, Skjema } from "./typer";

export const MAKS_KANDIDATER = 5;

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

type Vurdering = { godkjente: Vurdert[]; forkastede: Forkastet[]; antall: number };

const hentSpor = (sak: Sak, f: FeilProfil, spor: Spor, hent: HentKandidater, tapte = false) =>
  hent({ spor, a_variant: spor === "A" ? f.a_variant : null, kategori: f.kategori_pass2, heving_tillatt: sak.heving_tillatt_i_praksis, tapte });

function vurderKandidater(sak: Sak, f: FeilProfil, spor: Spor, kandidater: VedtakFeil[]): Vurdering {
  const godkjente: Vurdert[] = [];
  const forkastede: Forkastet[] = [];
  for (const v of kandidater) {
    const opplysning = spor === "A" && f.a_variant ? velgOpplysning(v, f.a_variant) : null;
    const kriterier = vurderKriterier(sak, f, v, opplysning);
    const dom = sterkereEnn(kriterier, sak, v);
    if (!dom.godkjent) {
      forkastede.push({ saksnummer: `${v.saksnummer} ${v.feil_id}`, grunn: dom.grunn });
      continue;
    }
    godkjente.push({ vedtak: v, kriterier, antall_sterkere: kriterier.filter((k) => k.utfall === "sterkere").length, svakhet: dom.svakhet });
  }
  return { godkjente: ranger(godkjente), forkastede, antall: kandidater.length };
}

// Every track the defect has, in the order avledFeil gives (A → C → B), one query each; the primary
// track's candidates come first. A decision found on two tracks counts once.
async function kandidaterFor(sak: Sak, f: FeilProfil, hent: HentKandidater): Promise<Vurdering> {
  const perSpor = await Promise.all(f.spor_alle.map(async (spor) => vurderKandidater(sak, f, spor, await hentSpor(sak, f, spor, hent))));
  const sett = new Set<number>();
  const godkjente = perSpor.flatMap((v) => v.godkjente).filter((x) => !sett.has(x.vedtak.vedtak_id) && sett.add(x.vedtak.vedtak_id));
  return { godkjente: godkjente.slice(0, MAKS_KANDIDATER), forkastede: perSpor.flatMap((v) => v.forkastede), antall: perSpor.reduce((n, v) => n + v.antall, 0) };
}

// Lost decisions in the same category on the primary track, by the committee's reason: shown to the
// buyer as what similar cases lost on, for the report order. No comparison, and no effect on strength.
async function tapteFor(sak: Sak, f: FeilProfil, hent: HentKandidater): Promise<Tapte> {
  const tapte = await hentSpor(sak, f, f.spor_primar!, hent, true);
  const fordeling: Record<string, number> = {};
  for (const v of tapte) fordeling[v.grunn ?? "ukjent"] = (fordeling[v.grunn ?? "ukjent"] ?? 0) + 1;
  const sett = new Set<number>();
  const nyeste = tapte
    .filter((v) => !sett.has(v.vedtak_id) && sett.add(v.vedtak_id))
    .slice(0, 2)
    .map((v) => ({ saksnummer: v.saksnummer, vedtaksdato: v.vedtaksdato, kilde_url: v.kilde_url, grunn: v.grunn }));
  return { fordeling, nyeste };
}

function kandidatRef(x: Vurdert): KandidatRef {
  const v = x.vedtak;
  return {
    vedtak_id: v.vedtak_id,
    feil_id: v.feil_id,
    saksnummer: v.saksnummer,
    vedtaksdato: v.vedtaksdato,
    kilde_url: v.kilde_url,
    spor: v.spor,
    lovversjon: v.lovversjon,
    sanksjon: v.sanksjon,
    kriterier: x.kriterier.map(({ navn, bruker, vedtak, utfall }) => ({ navn, bruker, vedtak, utfall })),
    antall_sterkere: x.antall_sterkere,
    svakhet: x.svakhet?.navn ?? null,
  };
}

const reklamertSent = (f: FeilProfil) => (f.dager_til_reklamasjon == null ? null : f.dager_til_reklamasjon > 60);

// The case, not the corpus (2026-10-10):
//   no track → svak;
//   a track but no won decision in the category → middels;
//   a decision, but the complaint came more than two months after discovery (fkjl § 27) → middels;
//   a decision → sterk.
function styrke(f: FeilProfil, antall: number): { styrke: FeilResultat["styrke"]; styrke_grunn: StyrkeGrunn | null } {
  if (f.forlik) return { styrke: null, styrke_grunn: null };
  if (!f.spor_alle.length) return { styrke: "svak", styrke_grunn: "ingen_spor" };
  if (!antall) return { styrke: "middels", styrke_grunn: "ingen_vedtak" };
  if (reklamertSent(f)) return { styrke: "middels", styrke_grunn: "reklamert_sent" };
  return { styrke: "sterk", styrke_grunn: null };
}

export async function sammenlign(skjema: Skjema, hent: HentKandidater, idag = new Date().toISOString().slice(0, 10)): Promise<Resultat> {
  // The engine reads one version of the form; an unknown one is refused (docs/skjema.md § 4).
  if (skjema._meta?.skjema_versjon !== SKJEMA_VERSJON) throw new Error(`Ukjent skjemaversjon: ${skjema._meta?.skjema_versjon ?? "mangler"}`);
  const sak = avledSak(skjema, idag);
  if (skjema.del1_kjopet.selgertype === "privat") return { stopp: "privat_selger", sak: sakProfil(sak), feil: [], valgt_til_brev: [], ingen_treff: [] };

  const profiler = skjema.del3_feil.map((f) => avledFeil(sak, f));
  // A settled defect is not claimed (110357), so it is not matched.
  const tom: Vurdering = { godkjente: [], forkastede: [], antall: 0 };
  const medSpor = (f: FeilProfil) => !f.forlik && f.spor_alle.length > 0;
  const [vurderinger, tapte] = await Promise.all([
    Promise.all(profiler.map((f) => (medSpor(f) ? kandidaterFor(sak, f, hent) : tom))),
    Promise.all(profiler.map((f) => (medSpor(f) ? tapteFor(sak, f, hent) : null))),
  ]);

  const ingenTreff: Resultat["ingen_treff"] = [];
  const feil = profiler.map((f, i): FeilResultat => {
    const { godkjente, forkastede, antall } = vurderinger[i];
    if (!godkjente.length) {
      const stopp = f.forlik
        ? "forlik: ikke vurdert"
        : !f.spor_primar
          ? `ingen_spor: ${f.ingen_spor_arsak}`
          : !antall
            ? `ingen kandidater på spor ${f.spor_alle.join("/")}`
            : `alle ${antall} kandidater forkastet`;
      ingenTreff.push({ feil_id: f.feil_id, siste_stopp: stopp });
    }
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
      kandidater: godkjente.map(kandidatRef),
      forkastede,
      ...styrke(f, godkjente.length),
      tapte: tapte[i],
      forlik: f.forlik,
      reklamasjon_over_to_mnd: reklamertSent(f),
    };
  });

  const valgt_til_brev = velgTilBrev(
    profiler.map((f, i) => ({ feil_id: f.feil_id, kostnad: f.kostnad_kr ?? 0, antall_sterkere: vurderinger[i].godkjente[0]?.antall_sterkere ?? null })),
  );
  return { stopp: null, sak: sakProfil(sak), feil, valgt_til_brev, ingen_treff: ingenTreff };
}

// The approved candidates with the decision rows behind them, for the practice paragraph (src/lib/praksis):
// the same filter as sammenlign, for one defect.
export async function kandidaterForFeil(skjema: Skjema, feil_id: string, hent: HentKandidater, idag: string): Promise<Vurdert[]> {
  const sak = avledSak(skjema, idag);
  const sf = skjema.del3_feil.find((f) => f.id === feil_id);
  if (!sf || skjema.del1_kjopet.selgertype === "privat") return [];
  const f = avledFeil(sak, sf);
  return f.forlik || !f.spor_alle.length ? [] : (await kandidaterFor(sak, f, hent)).godkjente;
}
