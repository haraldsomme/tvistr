"use client";

import Link from "next/link";
import { useKjopt } from "@/lib/app/lagring";

// «Til brevet» in the landing header, only for a buyer who has bought a case in this browser.
export function TilBrevet() {
  const [kjopt] = useKjopt();
  if (!kjopt.id) return null;
  return (
    <Link href={`/sak/${kjopt.id}`} className="btn-sec" style={{ height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #CBD3DD", background: "#FFFFFF", color: "#455063", fontSize: 14, fontWeight: 550, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
      Til brevet
    </Link>
  );
}
