"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { inneHint } from "@/lib/innlogging/navn";

const ingen = () => () => {};
const stil = { height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #CBD3DD", background: "#FFFFFF", color: "#455063", fontSize: 14, fontWeight: 550, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;

// The header's way to the account: Min side when logged in, else Logg inn. Decided in the browser from
// the hint cookie (the pages themselves check the real session), so the pages around it stay static
// (server snapshot: logged out). `bareInne` hides the logged-out link. «Logg inn» is a plain <a>: a
// <Link> would prefetch the route handler /logg-inn, which starts a login.
export function Konto({ bareInne = false }: { bareInne?: boolean }) {
  const inne = useSyncExternalStore(ingen, inneHint, () => false);
  if (bareInne && !inne) return null;
  return inne ? (
    <Link href="/min-side" className="btn-sec" style={stil}>
      Min side
    </Link>
  ) : (
    <a href="/logg-inn?til=/min-side" className="btn-sec" style={stil}>
      Logg inn
    </a>
  );
}
