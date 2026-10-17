// The check and the last purchase live in localStorage; a paid case itself is in the database (sak).
// Every read and write may fail (private window, blocked storage): a failed read gives the defaults,
// a failed write is ignored.
"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { erObjekt, flett } from "./flett";
import type { Kjopt } from "./saken";

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

// The last purchase (tvistr-sak): which case the check's «Åpne brevet» opens.
export const useKjopt = () => useLagret<Kjopt>("tvistr-sak", () => ({ id: "", reg: "", cats: [], parts: {} }));
