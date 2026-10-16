// The free assessment (step 4, docs/vurdering.md): «can I have a complaint case?», worked out by code
// from the answers in steps 1–3 and the database. Nothing here is written by a model, and nothing
// promises an outcome: the screen shows what the law says and what the committee did in similar cases.
//
// One pure function, so the screen, the server action and the tests read the same thing. The server
// action (src/app/sak/vurdering.ts) only fetches the decisions and the counted figures.
import { liste, smaa, tall } from "@/lib/brev/format";
import { OVER_TO_AAR_FEIL, plussManeder, tidsnivaFor } from "@/lib/brev/tidslinje";
import { type Lovversjon, lovRef, lovversjon } from "@/lib/brev/paragrafer";
import { feiltype } from "@/lib/brev/feiltype";
import { HOVEDKATEGORIER, komponenttype } from "@/lib/feil/kategorier";
import { type Niva, ranger, avgjorendeFor } from "@/lib/matching/ranger";
import type { RettsligPoeng } from "@/lib/matching/rett";
import type { Kandidat } from "@/lib/matching/typer";
import { byggSaken } from "@/lib/vedtaksvalg/kjoper";
import { MIN_ALDERSFORSKJELL, MIN_KM_ANDEL, visSaksnummer } from "@/lib/vedtaksvalg/mal";
import { MIN_SAKER, type Statistikkrad } from "./statistikk";

export type Status = "ute" | "svak" | "sak";
export type SomDenEr = "ja" | "nei" | "vet_ikke";

// The answers of steps 1–3. `ar` is the year the car was first registered.
export type Vurderingssak = {
  kjopsdato: string;
  idag: string;
  km: number | null;
  ar: number | null;
  somDenEr: SomDenEr | null;
  feil: { hoved: string; under: string[]; oppdaget: string }[];
};

// «svak» is a status for the measuring only: the buyer reads the same heading as for «sak».
export const OVERSKRIFT: Record<Status, string> = {
  ute: "Fristen for å reklamere er ute",
  svak: "Du kan ha en reklamasjonssak",
  sak: "Du kan ha en reklamasjonssak",
};

// What makes a case «svak», for the status and the log; not shown to the buyer. The texts are the same
// as the warnings in the form (step 2 and 3).
export type Grunn = { regel: "feil_over_to_aar" | "som_den_er_gammel" | "slitedel_sen" | "ingen_niva_a"; tekst: string; feilId?: string };

export const FEM_AAR_MND = 60;
const TO_AAR_MND = 24;
const SLITEDEL_MND = 6;
// «Som den er» before 2024 on an old car: older than this or driven further than this.
export const GAMMEL_ALDER = 10;
export const GAMMEL_KM = 200_000;

export const SOM_DEN_ER_GAMMEL =
  "Bilen ble solgt «som den er» før 2024 og var over 10 år gammel eller hadde gått over 200 000 km. Da skal det mer til før bilen er i dårligere stand enn du med rimelighet kunne forvente.";
export const INGEN_NIVA_A = "Vi har ingen vedtak om akkurat denne feilen på en bil som din.";
export const FRISTEN_UTE =
  "Det er mer enn fem år siden du overtok bilen. Den lengste fristen for å reklamere er fem år ({ref}), og dette brevet kan ikke brukes etter det. Mener du selger har holdt noe skjult, eller har du en garanti som gjelder lenger, bør du kontakte Forbrukerrådet eller en advokat.";

// Wear parts, as the warning names them (KOMPONENTTYPER.slitedel).
const SLITEDEL: Record<string, string> = {
  "drivlinje.clutch": "Clutchen regnes som en slitedel",
  "understell.bremser": "Bremsene regnes som en slitedel",
  "understell.demping": "Støtdempere og hjuloppheng regnes som slitedeler",
  "understell.hjullager": "Hjullager regnes som en slitedel",
  "elektrisk.startbatteri": "Startbatteri, dynamo og startmotor regnes som slitedeler",
  "utstyr.dekk": "Dekk og felger regnes som slitedeler",
  "motor.eksos": "Eksosanlegget regnes som en slitedel",
  "motor.registerreim": "Registerreim og kjede regnes som slitedeler",
  "karosseri.rust": "Rust regnes ofte som slitasje",
};
export const slitedelTekst = (nokkel: string) => `${SLITEDEL[nokkel]}, og feilen ble oppdaget mer enn 6 måneder etter kjøpet. Selger kan hevde at feilen skyldes normal slitasje.`;

export const alderVedKjop = (kjopsdato: string, ar: number | null) => (ar === null ? null : Math.max(0, Number(kjopsdato.slice(0, 4)) - ar));

// More than five years since the purchase (fkjl. § 27 annet ledd): the flow stops.
export const fristenErUte = (kjopsdato: string, idag: string) => kjopsdato < plussManeder(idag, -FEM_AAR_MND);

// The wear part of a defect, as «hoved.under»; null when none of its subcategories is one.
const slitedelAv = (f: Vurderingssak["feil"][number]) => f.under.map((u) => `${f.hoved}.${u}`).find((k) => k in SLITEDEL) ?? null;

// The warning in step 2 when the car was old and sold «som den er» before 2024.
export const somDenErGammel = (s: Pick<Vurderingssak, "kjopsdato" | "km" | "ar" | "somDenEr">) => {
  const alder = alderVedKjop(s.kjopsdato, s.ar);
  return s.somDenEr === "ja" && lovversjon(s.kjopsdato) === "før_2024" && ((alder !== null && alder > GAMMEL_ALDER) || (s.km !== null && s.km > GAMMEL_KM));
};

// The warning in step 3 for a wear part discovered after six months; null when it does not apply.
export function slitedelGrunn(kjopsdato: string, f: Vurderingssak["feil"][number]): Grunn | null {
  const nokkel = slitedelAv(f);
  return nokkel && f.oppdaget > plussManeder(kjopsdato, SLITEDEL_MND) ? { regel: "slitedel_sen", tekst: slitedelTekst(nokkel), feilId: f.hoved } : null;
}

// The status, from the answers and whether the ranking found a decision on the same defect (level A).
export function vurderStatus(s: Vurderingssak, harNivaA: boolean): { status: Status; grunner: Grunn[] } {
  if (fristenErUte(s.kjopsdato, s.idag)) return { status: "ute", grunner: [] };
  const grunner: Grunn[] = [];
  if (s.feil.some((f) => f.oppdaget > plussManeder(s.kjopsdato, TO_AAR_MND))) grunner.push({ regel: "feil_over_to_aar", tekst: OVER_TO_AAR_FEIL });
  if (somDenErGammel(s)) grunner.push({ regel: "som_den_er_gammel", tekst: SOM_DEN_ER_GAMMEL });
  for (const f of s.feil) {
    const g = slitedelGrunn(s.kjopsdato, f);
    if (g) grunner.push(g);
  }
  if (!harNivaA) grunner.push({ regel: "ingen_niva_a", tekst: INGEN_NIVA_A });
  return { status: grunner.length ? "svak" : "sak", grunner };
}

// «Dette sier loven om din sak»: fixed texts chosen by code, each with its paragraph from paragrafer.ts
// or none. `ikon`: ja (in the buyer's favour), nei (against), info. `uthevet`: the presumption, the
// strongest single point.
export type Lovlinje = { tema: "mangel" | "frist" | "bevisbyrde" | "forbehold" | "lovversjon"; ikon: "ja" | "nei" | "info"; tekst: string; paragraf: string | null; uthevet?: true };

const navnPa = (hoved: string) => smaa(HOVEDKATEGORIER.find((h) => h.id === hoved)?.navn ?? hoved);

export function lovlinjer(s: Vurderingssak): Lovlinje[] {
  const v = lovversjon(s.kjopsdato);
  const ut: Lovlinje[] = [];

  // What a defect is, for each kind of defect the buyer chose (the grounds of the letter's mangel()).
  // Every case has at least one line in the buyer's favour. A symptom («vet ikke ennå») is a part that
  // fails. Before 2024 a technical defect on a car sold «som den er» is judged by § 17, which the line
  // on the reservation gives instead.
  const arter = new Set(s.feil.flatMap((f) => (f.under.length ? f.under : [null]).map((u) => feiltype(f.hoved, u))));
  if ((arter.has("teknisk") || arter.has("vet_ikke")) && !(v === "før_2024" && s.somDenEr === "ja"))
    ut.push({ tema: "mangel", ikon: "ja", tekst: "Bilen skal ha den holdbarheten og de egenskapene du hadde grunn til å forvente. Gjør den ikke det, har den en mangel.", paragraf: lovRef(v, "avvik") });
  if (arter.has("opplysning")) ut.push({ tema: "mangel", ikon: "ja", tekst: "Bilen skal svare til det selger opplyste før kjøpet.", paragraf: lovRef(v, "uriktig") });
  if (arter.has("garanti")) ut.push({ tema: "mangel", ikon: "ja", tekst: "Bilen skal svare til det som er avtalt, også garantien.", paragraf: lovRef(v, "avtale") });

  // The limit runs from the handover to the complaint, which is now (or earlier, which step 6 asks).
  const typer = s.feil.flatMap((f) => (f.under.length ? f.under : [null]).map((u) => komponenttype(f.hoved, u)));
  if (s.idag <= plussManeder(s.kjopsdato, TO_AAR_MND))
    ut.push({ tema: "frist", ikon: "ja", tekst: "Du er innenfor fristen for å reklamere (to år fra overtakelsen).", paragraf: lovRef(v, "reklamasjon_2ar") });
  else if (typer.some((t) => t === "slitedel" || t === null))
    ut.push({ tema: "frist", ikon: "ja", tekst: "Fristen er fem år for deler som er ment å vare vesentlig lenger enn to år, ellers to år.", paragraf: lovRef(v, "reklamasjon_frister") });
  else ut.push({ tema: "frist", ikon: "ja", tekst: "Du er innenfor fristen for å reklamere (fem år fra overtakelsen).", paragraf: lovRef(v, "reklamasjon_5ar") });

  // The presumption, for the defects that are not about what the seller said (those existed at the sale).
  const frist = v === "før_2024" ? "6 måneder" : "2 år";
  const tekniske = s.feil.filter((f) => komponenttype(f.hoved, f.under[0] ?? null) !== "opplysning");
  const innen = tekniske.filter((f) => tidsnivaFor(s.kjopsdato, f.oppdaget, v).formodning);
  const etter = tekniske.filter((f) => !innen.includes(f));
  const blandet = innen.length > 0 && etter.length > 0;
  const subjekt = (fs: typeof tekniske) =>
    blandet ? `Feil${fs.length > 1 ? "ene" : "en"} ved ${liste(fs.map((f) => navnPa(f.hoved)))}` : fs.length > 1 ? "Feilene" : "Feilen";
  const den = (fs: typeof tekniske) => (fs.length > 1 ? "feilene" : "feilen");
  if (innen.length)
    ut.push({
      tema: "bevisbyrde",
      ikon: "ja",
      tekst: `${subjekt(innen)} viste seg innen ${frist}. Da er det selger som må bevise at ${den(innen)} ikke var der da du overtok bilen.`,
      paragraf: lovRef(v, "formodning"),
      uthevet: true,
    });
  if (etter.length)
    ut.push({
      tema: "bevisbyrde",
      ikon: "nei",
      tekst: `${subjekt(etter)} viste seg etter ${frist}. Da må du selv sannsynliggjøre at ${den(etter)} var der ved levering, typisk med en verkstedrapport. Brevet legger opp til det.`,
      paragraf: lovRef(v, "formodning"),
    });

  if (s.somDenEr === "ja")
    ut.push(
      v === "før_2024"
        ? { tema: "forbehold", ikon: "ja", tekst: "Bilen ble solgt «som den er». Du kan likevel reklamere hvis bilen er i dårligere stand enn du kunne forvente.", paragraf: lovRef(v, "forbehold") }
        : { tema: "forbehold", ikon: "ja", tekst: "Et alminnelig «som den er»-forbehold gjelder ikke lenger etter loven fra 2024.", paragraf: lovRef(v, "forbehold") },
    );

  ut.push({ tema: "lovversjon", ikon: "info", tekst: v === "før_2024" ? "Kjøpet følger forbrukerkjøpsloven slik den gjaldt før 2024." : "Kjøpet følger forbrukerkjøpsloven slik den gjelder fra 2024.", paragraf: null });
  return ut;
}

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
export function tallblokker(s: Vurderingssak, statistikk: Map<string, Statistikkrad>): Tallblokk[] {
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
export type Vedtakskort = { id: number; saksnummer: string | null; ar: string | null; bil: string; km: number | null; somDenEr: boolean; fikk: string[] };

const SANKSJONSNAVN: Record<string, string> = { heving: "heving", prisavslag: "prisavslag", retting: "retting", erstatning: "erstatning", omlevering: "omlevering" };

// The buyer-facing name of a legal point a level-B decision is cited for.
export const POENGNAVN: Record<RettsligPoeng, string> = {
  formodning: "bevisbyrden når feilen viser seg tidlig",
  som_den_er: "at «som den er» ikke fritar selgeren",
  sen_feil: "feil som viser seg etter to år",
  uriktig_opplysning: "uriktige opplysninger fra selgeren",
  tilbakeholdt_opplysning: "opplysninger selgeren holdt tilbake",
  tapt_retting: "når selgeren har tapt retten til å rette",
  palagt_retting: "selgerens plikt til å rette",
  heving: "vilkåret for heving",
  prisavslag: "utmåling av prisavslag",
};

export type VurderingResultat = {
  status: Status;
  grunner: Grunn[];
  lovversjon: Lovversjon;
  lovlinjer: Lovlinje[];
  tall: Tallblokk[];
  kort: Vedtakskort[];
  // The ranking's levels for the case as it is after step 3; the letter can still pick another
  // decision of the same level in step 7, when the claim is known.
  niva: Niva | null;
  // On level B: the buyer's legal points the best decision settled, by name.
  poeng: string[];
  // «Bilen din er yngre og har gått kortere enn i disse sakene.», or null when no side favours the buyer.
  sammenligning: string | null;
};

export const ANTALL_KORT = 3;

// The buyer's car against all of the cards, by the letter's rule (mal.ts): only what favours the buyer.
export function sammenlign(alder: number | null, km: number | null, kort: { alder: number | null; km: number | null }[]): string | null {
  if (!kort.length) return null;
  const deler: string[] = [];
  if (alder !== null && kort.every((k) => k.alder !== null && k.alder - alder >= MIN_ALDERSFORSKJELL)) deler.push("er yngre");
  if (km !== null && kort.every((k) => k.km !== null && km <= k.km * MIN_KM_ANDEL)) deler.push("har gått kortere");
  return deler.length ? `Bilen din ${liste(deler)} enn i disse sakene.` : null;
}

// `bilnavn`: make, model and model year of a decision, for a card whose extraction has no `bil`.
export function byggVurdering(inn: { sak: Vurderingssak; alle: Kandidat[]; statistikk: Map<string, Statistikkrad>; bilnavn: (id: number) => string | null }): VurderingResultat {
  const { sak: s } = inn;
  const v = lovversjon(s.kjopsdato);
  if (fristenErUte(s.kjopsdato, s.idag)) return { status: "ute", grunner: [], lovversjon: v, lovlinjer: [], tall: [], kort: [], niva: null, poeng: [], sammenligning: null };

  // The ranking as it will see the case in step 7, minus what is not asked yet (the claim, the seller's
  // statement, the workshop, repairs): those change the points, never the level.
  const { sak: brukersak } = byggSaken({
    kjopsdato: s.kjopsdato,
    km: s.km,
    ar: s.ar,
    somDenEr: s.somDenEr === "vet_ikke" ? null : s.somDenEr,
    krav: null,
    forsok: null,
    feil: s.feil.map((f) => ({ hoved: f.hoved, under: f.under, oppdaget: f.oppdaget, beskrivelse: null, opplysning: null, verksted: null })),
  });
  const { kandidater } = ranger(inn.alle, brukersak);
  const etterId = new Map(inn.alle.map((k) => [k.id, k]));
  const a = kandidater.filter((r) => r.niva === "A").slice(0, ANTALL_KORT);
  const profiler = a.map((r) => ({ alder: etterId.get(r.id)!.alder, km: etterId.get(r.id)!.km }));
  const kort: Vedtakskort[] = a.map((r) => {
    const k = etterId.get(r.id)!;
    const egne = r.feil ? (avgjorendeFor(k.avgjorende, r.feil)?.sanksjoner ?? []) : [];
    const fikk = (egne.length ? egne : (k.sanksjoner ?? [])).map((x) => SANKSJONSNAVN[x]).filter(Boolean);
    // The km is left out when the case was about the odometer, as in the letter.
    const omKm = r.feil?.hovedkategori === "historikk" && r.feil.underkategori === "km";
    return {
      id: k.id,
      saksnummer: visSaksnummer(k.saksnummer),
      ar: k.vedtaksdato?.slice(0, 4) ?? null,
      bil: k.avgjorende?.bil ?? inn.bilnavn(k.id) ?? "Bil",
      km: omKm ? null : k.km,
      somDenEr: k.somDenEr === true,
      fikk,
    };
  });
  const niva = kandidater[0]?.niva ?? null;
  const { status, grunner } = vurderStatus(s, a.length > 0);
  return {
    status,
    grunner,
    lovversjon: v,
    lovlinjer: lovlinjer(s),
    tall: tallblokker(s, inn.statistikk),
    kort,
    niva,
    poeng: niva === "B" ? kandidater[0].rett.slice(0, 2).map((p) => POENGNAVN[p]) : [],
    sammenligning: sammenlign(alderVedKjop(s.kjopsdato, s.ar), s.km, profiler),
  };
}

// The text under «Lignende saker» when there is no decision on the same defect.
export function utenNivaA(poeng: string[]): string {
  return poeng.length
    ? `${INGEN_NIVA_A} Brevet vil vise til et vedtak om det rettslige poenget i saken din (${liste(poeng)}).`
    : `${INGEN_NIVA_A} Brevet viser til et vedtak om et rettslig poeng i saken din hvis vi finner et som passer til kravet ditt, ellers bygger det på lovens vilkår.`;
}

export const fristenUteTekst = (kjopsdato: string) => FRISTEN_UTE.replace("{ref}", lovRef(lovversjon(kjopsdato), "reklamasjon_5ar"));
