// The buyer's answers live in localStorage only, never on the server. Every read and write may fail
// (private window, blocked storage): a failed read gives the defaults, a failed write is ignored.
"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const erObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const slag = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "liste" : typeof v);

// The stored fields over the defaults, keeping only those of the default's type (an edited or older
// draft must not crash the page). A default of null takes any plain value; unknown keys are kept.
function flett(s: Record<string, unknown>, v: Record<string, unknown>) {
  const ut = { ...s };
  for (const [k, x] of Object.entries(v)) {
    if (!(k in s) || slag(x) === slag(s[k]) || (s[k] === null && slag(x) !== "liste" && slag(x) !== "object")) ut[k] = x;
  }
  return ut;
}

// The stored value, merged over the defaults for objects; the defaults when missing, corrupt or of
// another shape.
export function les<T>(nokkel: string, standard: () => T): T {
  try {
    return tolk(localStorage.getItem(nokkel) ?? "", standard);
  } catch {
    return standard();
  }
}

export function skriv(nokkel: string, v: unknown): void {
  minne.set(nokkel, JSON.stringify(v));
  try {
    localStorage.setItem(nokkel, JSON.stringify(v));
  } catch {}
  lyttere.forEach((f) => f());
}

export function slett(nokkel: string): void {
  minne.delete(nokkel);
  try {
    localStorage.removeItem(nokkel);
  } catch {}
  lyttere.forEach((f) => f());
}

// The raw values per key, seeded from localStorage on first use and kept here too, so a blocked
// storage still works for the session.
const minne = new Map<string, string>();
const lyttere = new Set<() => void>();
function raa(nokkel: string): string {
  if (!minne.has(nokkel)) {
    let v = "";
    try {
      v = localStorage.getItem(nokkel) ?? "";
    } catch {}
    minne.set(nokkel, v);
  }
  return minne.get(nokkel)!;
}
function abonner(f: () => void) {
  lyttere.add(f);
  return () => void lyttere.delete(f);
}

function tolk<T>(r: string, standard: () => T): T {
  const s = standard();
  if (!r) return s;
  try {
    const v: unknown = JSON.parse(r);
    if (erObjekt(s)) return erObjekt(v) ? (flett(s, v) as T) : s;
    return typeof v === typeof s ? (v as T) : s;
  } catch {
    return s;
  }
}

// State backed by localStorage. The server render and the first client render have the defaults;
// `klar` turns true once the stored value is read.
export function useLagret<T>(nokkel: string, standard: () => T): [T, (neste: T | ((f: T) => T)) => void, boolean] {
  const r = useSyncExternalStore(abonner, () => raa(nokkel), () => null);
  // The defaults as given on the first render; later renders' functions are ignored.
  const [std] = useState(() => standard);
  const verdi = useMemo(() => tolk(r ?? "", std), [r, std]);
  const sett = useCallback(
    (neste: T | ((f: T) => T)) => {
      skriv(nokkel, typeof neste === "function" ? (neste as (f: T) => T)(tolk(raa(nokkel), std)) : neste);
    },
    [nokkel, std],
  );
  return [verdi, sett, r !== null];
}
