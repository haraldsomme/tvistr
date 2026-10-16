// «Lignende saker» on the verdict page: the counted figures for the buyer's categories and the three
// closest decisions with medhold, as fields only (no quotes, no link). Code and database only: nothing
// here reaches the model, and nothing promises an outcome.
import { liste, smaa, tall } from "@/lib/brev/format";
import { HOVEDKATEGORIER, komponentnavn } from "@/lib/feil/kategorier";
import { avgjorendeFor, ranger } from "@/lib/matching/ranger";
import type { Kandidat } from "@/lib/matching/typer";
import { byggSaken, type Svar } from "@/lib/vedtaksvalg/kjoper";
import { MIN_ALDERSFORSKJELL, MIN_KM_ANDEL, visSaksnummer } from "@/lib/vedtaksvalg/mal";
import { MIN_SAKER, type Statistikkrad } from "./statistikk";

// «Lignende saker»: the figures for one of the buyer's categories. `tall` is null when there are fewer
// than MIN_SAKER decisions; the block then only says that decisions exist.
export type Tallblokk = {
  nokkel: string;
  tema: string;
  tall: { saker: number; medhold: number; heving: number; prisavslag: number; retting: number; erstatning: number; prisavslagMedian: number | null } | null;
};

// A category as «saker om …» names it, where the form's name does not read as a noun phrase.
const TEMA: Record<string, string> = {
  vet_ikke: "feil med ukjent årsak",
  utstyr: "utstyr som ikke var som lovet",
  service: "service som ikke var utført som opplyst",
  garanti: "garanti som ikke var som lovet",
  "motor.annet_motor": "andre feil ved motoren",
  "elektrisk.annet_el": "andre elektriske feil",
  "utstyr.utstyr": "utstyr som manglet eller ikke virket",
  "service.service": "service som ikke var utført",
  "service.servicehefte": "manglende servicehefte",
  "historikk.bruk": "tidligere bruk og antall eiere",
  "vet_ikke.lyd": "unormal lyd",
};

// The subcategory when exactly one is chosen and it has enough decisions, else the main category; a
// category with no decision at all gives no block.
export function tallblokker(s: { feil: { hoved: string; under: string[] }[] }, statistikk: Map<string, Statistikkrad>): Tallblokk[] {
  const ut: Tallblokk[] = [];
  for (const f of s.feil) {
    const h = HOVEDKATEGORIER.find((x) => x.id === f.hoved);
    if (!h) continue;
    const under = f.under.length === 1 ? statistikk.get(`${f.hoved}.${f.under[0]}`) : undefined;
    const hoved = statistikk.get(f.hoved);
    const valgt = under && under.antallSaker >= MIN_SAKER ? { rad: under, navn: h.under.find((u) => u.id === f.under[0])!.navn } : hoved ? { rad: hoved, navn: h.navn } : null;
    if (!valgt || !valgt.rad.antallSaker) continue;
    const r = valgt.rad;
    ut.push({
      nokkel: r.nokkel,
      tema: TEMA[r.nokkel] ?? smaa(valgt.navn),
      tall:
        r.antallSaker >= MIN_SAKER
          ? { saker: r.antallSaker, medhold: r.antallMedhold, heving: r.heving, prisavslag: r.prisavslag, retting: r.retting, erstatning: r.erstatning, prisavslagMedian: r.prisavslagMedianProsent === null ? null : Math.round(r.prisavslagMedianProsent) }
          : null,
    });
  }
  return ut;
}

// The sentences of a block, the same on the screen and in the tests.
export function tallsetninger(b: Tallblokk): string[] {
  if (!b.tall) return [`Vi har vedtak om ${b.tema}.`];
  const t = b.tall;
  const utfall = (
    [
      ["heving", t.heving],
      ["prisavslag", t.prisavslag],
      ["retting", t.retting],
      ["erstatning", t.erstatning],
    ] as const
  ).filter(([, n]) => n > 0);
  return [
    `Utvalget har behandlet ${tall(t.saker)} saker om ${b.tema} i brukte biler kjøpt fra forhandler. I ${tall(t.medhold)} av dem fikk kjøperen medhold.`,
    ...(t.medhold && utfall.length ? [`Kjøperen fikk ${liste(utfall.map(([navn, n]) => `${navn} i ${tall(n)}`))} av sakene med medhold.`] : []),
    ...(t.prisavslagMedian !== null ? [`Prisavslagene lå typisk på ${t.prisavslagMedian} % av kjøpesummen.`] : []),
  ];
}

// One of «Saker som ligner din»: fields only, no quotes and no link. `fikk`: what the buyer got, in lower case.
// `feil`: the defect the decision had (the same kind as the buyer's), by name.
export type Vedtakskort = { id: number; saksnummer: string | null; ar: string | null; bil: string; km: number | null; somDenEr: boolean; fikk: string[]; feil: string | null };

const SANKSJONSNAVN: Record<string, string> = { heving: "heving", prisavslag: "prisavslag", retting: "retting", erstatning: "erstatning", omlevering: "omlevering" };

// The buyer-facing name of a legal point a level-B decision is cited for.
export const ANTALL_KORT = 3;

// The buyer's car against all of the cards, by the letter's rule (mal.ts): only what favours the buyer.
export function sammenlign(alder: number | null, km: number | null, kort: { alder: number | null; km: number | null }[]): string | null {
  if (!kort.length) return null;
  const deler: string[] = [];
  if (alder !== null && kort.every((k) => k.alder !== null && k.alder - alder >= MIN_ALDERSFORSKJELL)) deler.push("er yngre");
  if (km !== null && kort.every((k) => k.km !== null && km <= k.km * MIN_KM_ANDEL)) deler.push("har gått kortere");
  return deler.length ? `Bilen din ${liste(deler)} enn i disse sakene.` : null;
}

const alderVedKjop = (kjopsdato: string, ar: number | null) => (ar === null ? null : Math.max(0, Number(kjopsdato.slice(0, 4)) - ar));

// `bilnavn`: make, model and model year of a decision, for a card whose extraction has no `bil`.
export function lignende(inn: { svar: Svar; alle: Kandidat[]; statistikk: Map<string, Statistikkrad>; bilnavn: (id: number) => string | null }): { tall: Tallblokk[]; kort: Vedtakskort[]; sammenligning: string | null } {
  const { svar } = inn;
  const { kandidater } = ranger(inn.alle, byggSaken(svar).sak);
  const etterId = new Map(inn.alle.map((k) => [k.id, k]));
  const a = kandidater.filter((r) => r.niva === "A").slice(0, ANTALL_KORT);
  const kort: Vedtakskort[] = a.map((r) => {
    const k = etterId.get(r.id)!;
    const egne = r.feil ? (avgjorendeFor(k.avgjorende, r.feil)?.sanksjoner ?? []) : [];
    const fikk = (egne.length ? egne : (k.sanksjoner ?? [])).map((x) => SANKSJONSNAVN[x]).filter(Boolean);
    // The km is left out when the case was about the odometer, as in the letter.
    const omKm = r.feil?.hovedkategori === "historikk" && r.feil.underkategori === "km";
    return { id: k.id, saksnummer: visSaksnummer(k.saksnummer), ar: k.vedtaksdato?.slice(0, 4) ?? null, bil: k.avgjorende?.bil ?? inn.bilnavn(k.id) ?? "Bil", km: omKm ? null : k.km, somDenEr: k.somDenEr === true, fikk, feil: r.feil ? komponentnavn(r.feil) : null };
  });
  const profiler = a.map((r) => ({ alder: etterId.get(r.id)!.alder, km: etterId.get(r.id)!.km }));
  // With several faults, the figures for the fault the first card is about come first, so the block
  // and the cards below it are about the same thing.
  const forst = a[0]?.feil;
  const passer = (b: Tallblokk) => !!forst && (b.nokkel === forst.hovedkategori || b.nokkel === `${forst.hovedkategori}.${forst.underkategori}`);
  const tall = tallblokker(svar, inn.statistikk).sort((x, y) => Number(passer(y)) - Number(passer(x)));
  return { tall, kort, sammenligning: sammenlign(alderVedKjop(svar.kjopsdato, svar.ar), svar.km, profiler) };
}

// A decision's car when the extraction has no `bil`: make, model and model year, or the year alone.
export function bilnavnFra(merke: string | null, modell: string | null, arsmodell: number | null): string | null {
  const navn = [merke, modell].filter(Boolean).join(" ");
  if (navn) return arsmodell ? `${navn} ${arsmodell}` : navn;
  return arsmodell ? `Bil, årsmodell ${arsmodell}` : null;
}
