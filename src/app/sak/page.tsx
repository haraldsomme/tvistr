import type { Metadata } from "next";
import { Sakskjema } from "./skjema";

export const metadata: Metadata = { title: "Ny sak – tvistr" };

// The practice paragraph reads decisions with a model (actions.ts skrivPraksisFor): up to a minute per
// defect, and the general mode may follow the specific one.
export const maxDuration = 300;

// The buyer's form (docs/skjema.md), with the assessment and the letter under it.
export default function Page() {
  return <Sakskjema />;
}
