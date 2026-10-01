"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Forhandler } from "@/lib/vurdering/typer";
import { tittel, type Forslag } from "../selger-velger";

const gruppertOrgnr = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

// Not used by the assessment form; kept for the letter step, which needs the dealer.
// Dealer name with Brreg suggestions (/api/firma). A suggestion gives a «brreg» value with org.nr;
// anything typed freely stays a «fritekst» value, so a dealer missing from the register still works.
export function ForhandlerVelger({
  value,
  onChange,
  inputClass,
  labelClass,
}: {
  value: Forhandler;
  onChange: (v: Forhandler) => void;
  inputClass: string;
  labelClass: string;
}) {
  const id = useId();
  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [apen, setApen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const abort = useRef<AbortController | null>(null);

  const tekst = value.navn;
  const koblet = value.type === "brreg";
  const sok = !koblet && tekst.trim().length >= 3;
  const liste = sok ? forslag : [];

  useEffect(() => {
    abort.current?.abort();
    if (!sok) return;
    const ac = new AbortController();
    abort.current = ac;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/firma?q=${encodeURIComponent(tekst.trim())}`, { signal: ac.signal });
        const json = (await res.json()) as { forslag: Forslag[] };
        setForslag(json.forslag);
        setAktiv(-1);
      } catch {
        /* aborted or network error: keep the name as typed */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [tekst, sok]);

  const velg = (i: number) => {
    const f = liste[i];
    if (!f) return;
    onChange({ type: "brreg", orgnr: f.orgnr, navn: tittel(f.navn) });
    setApen(false);
  };

  function tast(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && liste.length) {
      e.preventDefault();
      setApen(true);
      setAktiv((a) => (a + 1) % liste.length);
    } else if (e.key === "ArrowUp" && liste.length) {
      e.preventDefault();
      setAktiv((a) => (a <= 0 ? liste.length - 1 : a - 1));
    } else if (e.key === "Enter" && apen && aktiv >= 0) {
      e.preventDefault();
      velg(aktiv);
    } else if (e.key === "Escape") setApen(false);
  }

  const visListe = apen && liste.length > 0;

  return (
    <div className="relative flex flex-col gap-[7px]">
      <label htmlFor={id} className={labelClass}>
        Forhandler
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={visListe}
        aria-controls={`${id}-liste`}
        aria-activedescendant={visListe && aktiv >= 0 ? `${id}-${aktiv}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        className={inputClass}
        value={tekst}
        onChange={(e) => {
          onChange({ type: "fritekst", navn: e.target.value.slice(0, 100) });
          setApen(true);
        }}
        onFocus={() => setApen(true)}
        onBlur={() => setTimeout(() => setApen(false), 120)}
        onKeyDown={tast}
      />
      {value.type === "brreg" && (
        <div className="font-ui text-[13px] leading-[1.4] text-[#1f5a45]">
          Koblet til Enhetsregisteret · org.nr {gruppertOrgnr(value.orgnr)}
        </div>
      )}
      {visListe && (
        <ul
          id={`${id}-liste`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-[6px] border border-[#bfbab0] bg-white shadow-[0_8px_24px_-12px_rgba(23,38,61,.35)]"
        >
          {liste.map((f, i) => (
            <li
              key={f.orgnr}
              id={`${id}-${i}`}
              role="option"
              aria-selected={aktiv === i}
              onMouseDown={() => velg(i)}
              onMouseEnter={() => setAktiv(i)}
              className={`cursor-pointer px-3.5 py-3 font-ui ${aktiv === i ? "bg-[#f6f4ef]" : ""} ${i > 0 ? "border-t border-[#eceae4]" : ""}`}
            >
              <span className="text-[15px] font-semibold text-[#17263d]">{tittel(f.navn)}</span>
              {f.status && (
                <span className="ml-2 rounded bg-[oklch(0.95_0.03_25)] px-1.5 py-0.5 text-[12px] text-[oklch(0.42_0.12_25)]">{f.status}</span>
              )}
              <span className="mt-0.5 block text-[13px] leading-[1.4] text-[#5b6472]">
                {[f.kommune && tittel(f.kommune), f.bransje, `org.nr ${gruppertOrgnr(f.orgnr)}`].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
