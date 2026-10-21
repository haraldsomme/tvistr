"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { inneHint } from "@/lib/innlogging/navn";

const ingen = () => () => {};
const ramme = { height: 42, padding: "0 16px", borderRadius: 12, border: "1px solid #CDD5D2", background: "#FFFFFF", color: "#465150", fontSize: 14, fontWeight: 550, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;
// On the landing page: a plain link in the header, and a row in the dropdown menu on narrow screens.
const lenke = { height: 44, padding: "0 14px", borderRadius: 12, fontSize: 15, fontWeight: 500, color: "#111515", whiteSpace: "nowrap", display: "flex", alignItems: "center", textDecoration: "none" } as const;
const meny = { minHeight: 52, borderTop: "1px solid #E3E6E8", fontSize: 17, fontWeight: 500, color: "#1F3A5F", display: "flex", alignItems: "center", textDecoration: "none" } as const;

const STIL = {
  ramme: { className: "btn-sec", style: ramme },
  lenke: { className: "lp-ghost", style: lenke },
  meny: { className: undefined, style: meny },
};

// The header's way to the account: Min side when logged in, else Logg inn. Decided in the browser from
// the hint cookie (the pages themselves check the real session), so the pages around it stay static
// (server snapshot: logged out). «Logg inn» is a plain <a>: a
// <Link> would prefetch the route handler /logg-inn, which starts a login.
export function Konto({ variant = "ramme", onVelgAction }: { variant?: keyof typeof STIL; onVelgAction?: () => void }) {
  const inne = useSyncExternalStore(ingen, inneHint, () => false);
  const { className, style } = STIL[variant];
  return inne ? (
    <Link href="/min-side" className={className} style={style} onClick={onVelgAction}>
      Min side
    </Link>
  ) : (
    <a href="/logg-inn?til=/min-side" className={className} style={style} onClick={onVelgAction}>
      Logg inn
    </a>
  );
}
