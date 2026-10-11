import type { Metadata } from "next";
import { Topp } from "@/app/topp";
import { Skjema } from "./skjema";

export const metadata: Metadata = { title: "Ny sak – tvistr" };

// Step 1: the car from the registration number. Step 2: the defects. «Lag brev» counts matching
// decisions with medhold; the letter itself is built later.
export default function Page() {
  return (
    <div className="flex h-dvh flex-col">
      <Topp />
      <Skjema />
    </div>
  );
}
