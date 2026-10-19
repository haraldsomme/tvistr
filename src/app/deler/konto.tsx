"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { INNE } from "@/lib/innlogging/navn";

const ingen = () => () => {};
// A hint only (the readable cookie set at login); the pages themselves check the real session.
const erInne = () => document.cookie.split("; ").includes(`${INNE}=1`);

// The header's way to the account: Min side when logged in, else Logg inn. Decided in the browser
// so the pages around it stay static (server snapshot: logged out). `bareInne` hides the logged-out link.
export function Konto({ bareInne = false }: { bareInne?: boolean }) {
  const inne = useSyncExternalStore(ingen, erInne, () => false);
  if (bareInne && !inne) return null;
  return (
    <Link href={inne ? "/min-side" : "/logg-inn?til=/min-side"} className="btn-sec" style={{ height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #CBD3DD", background: "#FFFFFF", color: "#455063", fontSize: 14, fontWeight: 550, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
      {inne ? "Min side" : "Logg inn"}
    </Link>
  );
}
