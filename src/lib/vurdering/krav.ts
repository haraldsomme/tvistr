import type { Faktorer } from "./faktorer";
import { typiskBelop } from "./belop";
import { ONSKER, type Onske } from "./typer";

// Which claim to recommend, and what the decisions say about the odds of getting it. The claims
// follow the order in the consumer sales act: the dealer may try to repair first, then price
// reduction or rescission, with compensation for documented losses on top.

export type Krav = "retting" | "prisavslag" | "heving";

export type Kravalternativ = {
  krav: Krav;
  tittel: string;
  // Odds in plain words.
  sjanse: string;
  tekst: string;
  anbefalt: boolean;
};

// The claims for each wish the buyer can pick on the result page, plus «standard» when none is picked.
export type KravPerOnske = Record<Onske | "standard", Kravalternativ[]>;

// Share of buyers claiming rescission (prinsipalt_krav = heving, dealer cases, n = 1 092) who got
// it, meaning at least 80 % of the purchase price awarded. Computed 2026-10-01 from vedtak.
// The others mostly got a price reduction instead.
export const HEVING = {
  grunn: 32,
  rettingForsokt: 54, // a repair attempt was a topic in the decision, n = 169
  utbedringUnder25: 14, // repair cost under 25 % of the price, n = 183
  utbedring25til50: 34, // n = 151
  utbedringOver50: 39, // n = 261
} as const;

// Share of buyers claiming price reduction who got medhold (dealer cases, about 64 %). The median
// award is about half of the amount claimed (n = 359).
const PRISAVSLAG_MEDHOLD_PST = 65;

// Rescission is only realistic when the defect is not minor; below this the usual outcome is a
// price reduction.
export const HEVING_MIN_ANDEL = 0.25;

const rund5 = (pst: number) => Math.round(pst / 5) * 5;
const kr = (v: number) => `${v.toLocaleString("nb-NO")} kr`;

export function utbedringsAndel(f: Faktorer): number | null {
  return f.utbedringskostnadNok != null && f.kjopesumNok > 0 ? f.utbedringskostnadNok / f.kjopesumNok : null;
}

// Several factors can apply, but there is no data on them together, so we never promise more than
// the most cautious one. With none known we fall back to the overall rate.
export function hevingSjanse(f: Faktorer): { pst: number; grunn: string } {
  const andel = utbedringsAndel(f);
  const faktorer: { pst: number; grunn: string }[] = [];

  if (f.forhandlerRetting !== "ikke_spurt") {
    faktorer.push({ pst: HEVING.rettingForsokt, grunn: "Når forhandleren har forsøkt å rette feilen uten hell, er sjansen bedre." });
  }
  if (andel != null) {
    const prosent = Math.round(andel * 100);
    if (andel < HEVING_MIN_ANDEL) {
      faktorer.push({ pst: HEVING.utbedringUnder25, grunn: `Feilen koster ${prosent} % av kjøpesummen å utbedre. Under en fjerdedel ender det oftest med prisavslag.` });
    } else if (andel < 0.5) {
      faktorer.push({ pst: HEVING.utbedring25til50, grunn: `Feilen koster ${prosent} % av kjøpesummen å utbedre.` });
    } else {
      faktorer.push({ pst: HEVING.utbedringOver50, grunn: `Feilen koster ${prosent} % av kjøpesummen å utbedre. Over halvparten øker sjansen.` });
    }
  }
  if (faktorer.length === 0) return { pst: HEVING.grunn, grunn: "" };
  return faktorer.reduce((a, b) => (b.pst < a.pst ? b : a));
}

// Without a wish we recommend the claim most likely to succeed.
export function anbefaltKrav(f: Faktorer, onske: Onske | null): Krav {
  if (f.forhandlerRetting === "ikke_spurt") return "retting";
  const andel = utbedringsAndel(f);
  const hevingMulig = andel == null || andel >= HEVING_MIN_ANDEL;
  return onske === "levere_tilbake" && hevingMulig ? "heving" : "prisavslag";
}

export function foreslaKrav(f: Faktorer, onske: Onske | null): Kravalternativ[] {
  const anbefalt = anbefaltKrav(f, onske);
  const ikkeRettet = f.forhandlerRetting === "ikke_spurt";
  const etterRetting = ikkeRettet ? "Hvis forhandleren ikke lykkes med å rette: " : "";
  const belop = typiskBelop(f.kjopesumNok);
  const heving = hevingSjanse(f);

  const alle: Kravalternativ[] = [];

  if (ikkeRettet) {
    alle.push({
      krav: "retting",
      tittel: "Krev retting",
      sjanse: "Forhandleren har rett til å forsøke å rette feilen først.",
      tekst:
        "Brevet krever retting innen rimelig frist, med prisavslag eller heving som alternativ hvis de ikke leverer." +
        (onske === "levere_tilbake"
          ? " Du ønsker å levere bilen tilbake, og det kan du kreve hvis rettingen ikke lykkes. Brevet tar det med som alternativ."
          : ""),
      anbefalt: anbefalt === "retting",
    });
  }

  alle.push({
    krav: "prisavslag",
    tittel: "Krev prisavslag",
    sjanse: `${etterRetting}Ca. ${PRISAVSLAG_MEDHOLD_PST} % får medhold. Typisk tilkjent ${kr(belop.lav)}–${kr(belop.hoy)}, ofte omtrent halvparten av det som kreves.`,
    tekst:
      "Du beholder bilen og får penger tilbake tilsvarende feilen. Dokumenterte utgifter, som verkstedregning eller leiebil, kan kreves som erstatning i tillegg." +
      (onske === "reparasjon" && !ikkeRettet ? " Vil du fortsatt ha feilen reparert, kan beløpet dekke reparasjon hos et annet verksted." : ""),
    anbefalt: anbefalt === "prisavslag",
  });

  alle.push({
    krav: "heving",
    tittel: "Krev heving (levere bilen tilbake)",
    sjanse: `${etterRetting}Ca. ${rund5(heving.pst)} % av dem som krever heving får det. ${heving.grunn}`.trim(),
    // § 32: the buyer may rescind unless the seller proves the defect is minor.
    tekst:
      "Du leverer bilen tilbake og får kjøpesummen tilbake, minus en eventuell avkorting for bruk. Forhandleren kan bare nekte hvis de kan vise at mangelen er uvesentlig.",
    anbefalt: anbefalt === "heving",
  });

  // Recommended first, otherwise keep the order of the claims.
  return [...alle.filter((a) => a.anbefalt), ...alle.filter((a) => !a.anbefalt)];
}

export function alleKrav(f: Faktorer): KravPerOnske {
  return {
    standard: foreslaKrav(f, null),
    ...(Object.fromEntries(ONSKER.map((o) => [o, foreslaKrav(f, o)])) as Record<Onske, Kravalternativ[]>),
  };
}
