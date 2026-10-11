import type { Metadata } from "next";
import { Topp } from "@/app/topp";
import { Skjema } from "./skjema";

export const metadata: Metadata = { title: "Ny sak – tvistr" };

// The buyer's form: car, defects, details, claim. «Lag brev» ranks the decisions with medhold and
// step 5 shows the best ones; the letter itself is built later.
export default function Page() {
  return (
    <div className="flex h-dvh flex-col">
      <Topp />
      <Skjema />
    </div>
  );
}
