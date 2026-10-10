import type { Metadata } from "next";
import { Sakskjema } from "./skjema";

export const metadata: Metadata = { title: "Ny sak – tvistr" };

// The buyer's form (docs/skjema.md), with the assessment and the letter under it.
export default function Page() {
  return <Sakskjema />;
}
