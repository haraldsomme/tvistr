// The letter's blocks and the decision it can cite, apart from brev.ts so that code which only draws
// or passes the letter need not import the code that writes it.
import type { Kriterium, Niva, Treff } from "@/lib/matching/ranger";

// Text, a placeholder for a missing answer, one of the buyer's own answers with its field (a `Skjema`
// key, or «key.sub» for per-area and list values), or hidden text of about `skjult` characters.
// Nothing in the body is emphasised: the headings are the only bold text, as in a lawyer's letter.
export type Del = string | { ph: string } | { felt: string; tekst: string } | { skjult: number };
export type Blokk =
  | { t: "addr" | "sign"; linjer: Del[][] }
  | { t: "date" | "subj" | "h" | "p"; tekst: Del[] }
  | { t: "ol"; punkter: Del[][] }
  | { t: "prec"; avsnitt: Del[][] };

// One of the (up to ten) decisions the letter can cite, as finnVedtak returns it after payment.
export type Presedens = {
  id: number;
  saksnummer: string | null;
  vedtaksdato: string | null;
  bil: string;
  utfall: string[];
  avsnitt: string;
  kildeUrl: string | null;
  utvalg: string;
  // The model's choice («Anbefalt»); the rest follow in the ranking's order.
  anbefalt: boolean;
  niva: Niva;
  // What the decision was about: the defect on level A, the legal points on level B.
  gjaldt: string;
  km: number | null;
  alder: number | null;
  somDenEr: boolean | null;
  // 0–100 on the ranking's points (matching/likhet.ts), and how each criterion compared.
  likhet: number;
  treff: Record<Kriterium, Treff>;
};
