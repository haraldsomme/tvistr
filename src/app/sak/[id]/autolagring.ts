"use client";

// The writer saves the form to the case (lagreSak) as the buyer types: once they pause, at once when the
// page is hidden or left, and again a little later when a save fails. One save at a time; changes made
// while one runs go in the next. Leaving the page with unsaved changes asks first.
import { useEffect, useRef, useState } from "react";
import { trygt } from "@/lib/app/kall";
import type { Skjema } from "@/lib/app/skjema";
import { lagreSak } from "./actions";

export type Lagring = "lagret" | "lagrer" | "feil";

const PAUSE_MS = 800;
const PROV_IGJEN_MS = 5000;

export function useAutolagring(id: string, skjema: Skjema): Lagring {
  const [status, settStatus] = useState<Lagring>("lagret");
  const lagret = useRef(JSON.stringify(skjema));
  const naa = useRef(skjema);
  const pagar = useRef(false);
  const tid = useRef<ReturnType<typeof setTimeout>>(undefined);
  const send = useRef(async () => {});

  useEffect(() => {
    send.current = async () => {
      clearTimeout(tid.current);
      if (pagar.current) return;
      const s = naa.current;
      const json = JSON.stringify(s);
      if (json === lagret.current) return settStatus("lagret");
      pagar.current = true;
      settStatus("lagrer");
      const r = await trygt(lagreSak({ id, skjema: s }), "Ikke lagret.");
      pagar.current = false;
      if (!r.ok) {
        settStatus("feil");
        tid.current = setTimeout(() => send.current(), PROV_IGJEN_MS);
        return;
      }
      lagret.current = json;
      if (JSON.stringify(naa.current) !== json) send.current();
      else settStatus("lagret");
    };
  }, [id]);

  useEffect(() => {
    naa.current = skjema;
    if (JSON.stringify(skjema) === lagret.current) return;
    clearTimeout(tid.current);
    tid.current = setTimeout(() => send.current(), PAUSE_MS);
  }, [skjema]);

  useEffect(() => {
    const skjult = () => document.visibilityState === "hidden" && send.current();
    const forlat = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(naa.current) === lagret.current) return;
      send.current();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", skjult);
    window.addEventListener("beforeunload", forlat);
    return () => {
      document.removeEventListener("visibilitychange", skjult);
      window.removeEventListener("beforeunload", forlat);
      send.current();
    };
  }, []);

  return status;
}
