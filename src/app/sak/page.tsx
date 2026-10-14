import type { Metadata } from "next";
import { Skjema } from "./skjema";

export const metadata: Metadata = { title: "Sjekk saken din – tvistr" };

// The buyer's form, from the registration number to the letter (skjema.tsx, docs/skjema.md). The
// landing page sends the number as ?regnr=, which the form reads on the client.
export default function Page() {
  return (
    <div className="flex h-dvh flex-col">
      <Skjema />
    </div>
  );
}
