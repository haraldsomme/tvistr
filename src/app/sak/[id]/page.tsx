import type { Metadata } from "next";
import { Skriver } from "./skriver";

export const metadata: Metadata = { title: "Brevskriveren – Tvistr" };

// The letter writer, after payment (skriver.tsx).
export default function Page() {
  return <Skriver />;
}
