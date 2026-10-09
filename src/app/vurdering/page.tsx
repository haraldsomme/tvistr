import type { Metadata } from "next";
import type { Skjema } from "@/lib/sammenligning";
import enyaq from "@/lib/sammenligning/testdata/enyaq-skjema.json";
import testsaker from "@/lib/sammenligning/testdata/testsaker.json";
import { Vurderingsskjema } from "./skjema";

export const metadata: Metadata = { title: "Vurdering – tvistr" };

// Test page for the comparison engine: fill in the form (or load a test case) and see the
// practice paragraph per defect.
export default function Page() {
  const eksempler = [
    { id: "enyaq", navn: "Enyaq (regresjonssaken)", skjema: enyaq as unknown as Skjema },
    ...testsaker.saker.map((s) => ({ id: s.id, navn: `${s.id} ${s.navn}`, skjema: s.input as unknown as Skjema })),
  ];
  return <Vurderingsskjema eksempler={eksempler} />;
}
