import type { Metadata } from "next";
import { Sakskjema } from "./skjema";

export const metadata: Metadata = { title: "Ny sak – tvistr" };

// The complaint form (docs/skjema.md). It runs in the browser and sends the finished JSON to the
// comparison engine through a Server Action (./actions.ts).
export default function Page() {
  return <Sakskjema />;
}
