"use client";

import { useEffect, useState } from "react";
import type { Endring, Utfylling } from "@/lib/brev/utfylling";
import type { Mappe } from "@/lib/mappe/typer";
import { AktorInnhold, AvgjordeInnhold, BelopInnhold, Kort, StyrkeInnhold, StyrkInnhold, VidereInnhold } from "./kort";

type Tilstand = { type: "laster" } | { type: "feil"; melding: string } | { type: "ok"; mappe: Mappe };

// The saksmappe: fetched when the tab opens and again when what the numbers depend on changes (the
// answers, the claim, the dealer). `lagre` saves one field of the case and says whether it worked.
export function Saksmappe({ sakId, avhengighet, utfylling, lagre }: { sakId: string; avhengighet: string; utfylling: Utfylling; lagre: (e: Endring) => Promise<boolean> }) {
  const [t, setT] = useState<Tilstand>({ type: "laster" });
  useEffect(() => {
    const avbryt = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/sak/${sakId}/mappe`, { signal: avbryt.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.feil ?? "");
        setT({ type: "ok", mappe: json as Mappe });
      } catch (e) {
        if (avbryt.signal.aborted) return;
        setT({ type: "feil", melding: (e instanceof Error && !(e instanceof TypeError) && e.message) || "Vi fikk ikke hentet saksmappen. Prøv igjen om litt." });
      }
    })();
    return () => avbryt.abort();
  }, [sakId, avhengighet]);

  if (t.type === "laster")
    return (
      <p role="status" className="m-0 text-[14px] text-[#5b6472]">
        Henter saksmappen …
      </p>
    );
  if (t.type === "feil")
    return (
      <p role="alert" className="m-0 text-[14px] text-[#a23b2a]">
        {t.melding}
      </p>
    );
  const m = t.mappe;
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-5">
      <p className="m-0 max-w-[720px] text-[14px] leading-[1.6] text-[#3d4757]">
        Tallene er hentet fra tidligere vedtak i Forbrukerklageutvalget om bruktbil. De sier noe om hva som er vanlig, ikke hva som skjer i din sak.
      </p>
      <Kort tittel="Sakens styrke">
        <StyrkeInnhold k={m.styrke} />
      </Kort>
      <Kort tittel="Hva kan du få?">
        <BelopInnhold k={m.belop} />
      </Kort>
      <Kort tittel="Hva avgjorde lignende saker?">
        <AvgjordeInnhold k={m.avgjorde} valgt={utfylling.lignende ?? []} lagre={lagre} />
      </Kort>
      <Kort tittel="Forhandleren og bilen">
        <AktorInnhold k={m.aktorer} />
      </Kort>
      <Kort tittel="Styrk saken">
        <StyrkInnhold punkter={m.styrk} sjekket={utfylling.sjekket ?? []} lagre={lagre} />
      </Kort>
      <Kort tittel="Veien videre">
        <VidereInnhold k={m.videre} sakId={sakId} sendt={utfylling.sendt} idag={m.idag} lagre={lagre} />
      </Kort>
    </div>
  );
}
