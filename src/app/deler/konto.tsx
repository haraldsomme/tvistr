"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { inneHint } from "@/lib/innlogging/navn";
import { Bruker } from "./ikoner";

const ramme = { height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #CDD5D2", background: "#FFFFFF", color: "#465150", fontSize: 14, fontWeight: 550, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;

// The header's way to the account: Min side when logged in, else Logg inn. Decided in the browser from
// the hint cookie (the pages themselves check the real session), so the pages around it stay static
// (server snapshot: logged out). «Logg inn» is a plain <a>: a
// <Link> would prefetch the route handler /logg-inn, which starts a login.
// Whether this browser logged in, by the hint cookie; logged out on the server and the first render.
// Here and not in navn.ts, which the server imports (okt.ts) and so cannot hold a client hook.
const ingen = () => () => {};
export const useInne = () => useSyncExternalStore(ingen, inneHint, () => false);

export function Konto() {
  const inne = useInne();
  return inne ? (
    <Link href="/min-side" className="btn-sec" style={{ ...ramme, gap: 8 }}>
      <Bruker s={18} />
      Min side
    </Link>
  ) : (
    <a href="/logg-inn?til=/min-side" className="btn-sec" style={ramme}>
      Logg inn
    </a>
  );
}
