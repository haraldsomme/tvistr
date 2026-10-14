"use client";

import { useEffect } from "react";
import { type Hendelse, maal } from "@/lib/maling";

// Measures that a page was shown (src/lib/maling.ts), once per mount.
export function MaalVisning({ hendelse }: { hendelse: Hendelse }) {
  useEffect(() => maal(hendelse), [hendelse]);
  return null;
}
