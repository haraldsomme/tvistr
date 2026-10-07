"use client";

import { useRef, useState } from "react";
import type { Fremdrift } from "@/lib/brev/skriving/kjede";
import type { Utfylling } from "@/lib/brev/utfylling";
import { Spinner } from "@/components/ui/spinner";

// Writing the letter (`POST /api/sak/[id]/skriv`): a stream of progress lines, then the case as stored
// with the letter. Started once at a time, even when an effect runs twice in development.

const FREMDRIFT_TEKST: Record<Fremdrift, string> = {
  skriver: "Skriver brevet …",
  kontrollerer: "Kontrollerer fakta, datoer og sitater …",
  leser: "Leser gjennom brevet …",
  retter: "Retter det vi fant …",
};

type Linje = { fremdrift?: Fremdrift; ferdig?: true; utfylling?: Utfylling; feil?: string };

export function useSkriving(id: string, ferdig: (u: Utfylling) => void) {
  const [fremdrift, setFremdrift] = useState<Fremdrift | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const igang = useRef(false);

  async function skriv() {
    if (igang.current) return;
    igang.current = true;
    setFeil(null);
    setFremdrift("skriver");
    try {
      const res = await fetch(`/api/sak/${id}/skriv`, { method: "POST" });
      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => null)) as { feil?: string } | null;
        throw new Error(json?.feil ?? "");
      }
      const leser = res.body.getReader();
      const dekoder = new TextDecoder();
      let rest = "";
      let lagret = false;
      for (;;) {
        const { done, value } = await leser.read();
        if (done) break;
        rest += dekoder.decode(value, { stream: true });
        for (let i = rest.indexOf("\n"); i >= 0; i = rest.indexOf("\n")) {
          const linje = rest.slice(0, i).trim();
          rest = rest.slice(i + 1);
          if (!linje) continue;
          const l = JSON.parse(linje) as Linje;
          if (l.feil) throw new Error(l.feil);
          if (l.fremdrift) setFremdrift(l.fremdrift);
          if (l.ferdig && l.utfylling) {
            ferdig(l.utfylling);
            lagret = true;
          }
        }
      }
      if (!lagret) throw new Error("");
    } catch (e) {
      setFeil((e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError) && e.message) || "Vi fikk ikke skrevet brevet akkurat nå. Prøv igjen om litt.");
    } finally {
      igang.current = false;
      setFremdrift(null);
    }
  }

  return { skriv, fremdrift, feil, skriver: fremdrift !== null };
}

export function Venteskjerm({ fremdrift }: { fremdrift: Fremdrift }) {
  return (
    <section aria-live="polite" className="flex w-full flex-col gap-3 rounded-lg border border-[#dcd8cf] bg-white px-6 py-10 text-[#17263d]">
      <p className="m-0 flex items-center gap-2 font-brev text-[20px] font-semibold">
        <Spinner aria-hidden /> {FREMDRIFT_TEKST[fremdrift]}
      </p>
      <p className="m-0 text-[14px] leading-[1.55] text-[#5b6472]">Vi skriver brevet ut fra det du har fylt inn, og kontrollerer at hvert faktum, hver dato og hvert sitat stemmer med saken. Det tar vanligvis ett til to minutter.</p>
    </section>
  );
}
