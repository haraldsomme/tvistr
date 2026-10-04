"use client";

import { useState } from "react";
import type { Motargument } from "@/lib/brev/motsvar";

const KNAPP_LITEN = "rounded-[6px] border border-[#bfbab0] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#17263d] disabled:text-[#8a94a3]";

// The tab beside the letter: what the dealer is likely to answer, and what to say back. The ones that
// fit the case come first and are open.
export function Motsvar({ motargumenter }: { motargumenter: Motargument[] }) {
  const [kopiert, setKopiert] = useState<string | null>(null);
  async function kopier(nokkel: string, tekst: string) {
    try {
      await navigator.clipboard.writeText(tekst);
      setKopiert(nokkel);
    } catch {
      setKopiert(null);
    }
  }
  return (
    <section aria-labelledby="motsvar-tittel" className="flex w-full max-w-[820px] flex-col gap-4">
      <h2 id="motsvar-tittel" className="m-0 font-brev text-[22px] font-semibold leading-[1.3]">
        Hvis forhandleren svarer
      </h2>
      <p className="m-0 text-[14px] leading-[1.6] text-[#3d4757]">
        Dette er vanlige grunner forhandlere gir for å avvise et krav, med et svar du kan bruke. Svar skriftlig, og ta vare på det forhandleren skriver.
      </p>
      <div className="flex flex-col gap-2.5">
        {motargumenter.map((m) => (
          <details key={m.nokkel} open={m.relevant} className="rounded-lg border border-[#dcd8cf] bg-white p-4 text-[14px] leading-[1.6] text-[#3d4757]">
            <summary className="cursor-pointer font-semibold text-[#17263d]">
              {m.tittel}
              {m.relevant && <span className="ml-2 text-[12px] font-normal text-[#6b5618]">passer saken din</span>}
            </summary>
            <p className="mb-2 mt-2">{m.svar}</p>
            <button type="button" onClick={() => kopier(m.nokkel, m.svar)} className={KNAPP_LITEN}>
              {kopiert === m.nokkel ? "Kopiert" : "Kopier svar"}
            </button>
          </details>
        ))}
      </div>
    </section>
  );
}
