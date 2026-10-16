"use client";

import Link from "next/link";
import { useLagret } from "@/lib/app/lagring";

// «Til brevskriveren» in the landing header, only for a buyer who has unlocked the writer.
export function TilBrevskriveren() {
  const [ordre] = useLagret("tvistr-ordre", () => "");
  if (!ordre) return null;
  return (
    <Link href="/brev" className="btn-sec" style={{ height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #CBD3DD", background: "#FFFFFF", color: "#455063", fontSize: 14, fontWeight: 550, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
      Til brevskriveren
    </Link>
  );
}
