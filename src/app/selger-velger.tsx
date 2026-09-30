"use client";

import { useEffect, useId, useRef, useState } from "react";

type Forslag = { orgnr: string; navn: string; kommune: string | null; bransje: string | null; status: string | null };
type Valg =
  | { type: "brreg"; orgnr: string; navn: string }
  | { type: "fritekst"; navn: string }
  | { type: "privat" };

const tittel = (s: string) => s.toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(As|Asa)\b/g, (m) => m.toUpperCase());

export function SelgerVelger() {
  const id = useId();
  const [tekst, setTekst] = useState("");
  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [apen, setApen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const [laster, setLaster] = useState(false);
  const [valg, setValg] = useState<Valg | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    abort.current?.abort();
    if (valg || tekst.trim().length < 3) return;
    const ac = new AbortController();
    abort.current = ac;
    const t = setTimeout(async () => {
      setLaster(true);
      try {
        const res = await fetch(`/api/firma?q=${encodeURIComponent(tekst.trim())}`, { signal: ac.signal });
        const json = (await res.json()) as { forslag: Forslag[] };
        setForslag(json.forslag);
        setAktiv(-1);
        setLaster(false);
      } catch {
        /* aborted or network error: keep previous suggestions */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [tekst, valg]);

  const visForslag = tekst.trim().length >= 3 ? forslag : [];
  const alternativer = tekst.trim().length >= 3 ? visForslag.length + 1 : 0; // last one is "use as typed"
  const velg = (v: Valg) => {
    setValg(v);
    setApen(false);
  };
  const velgIndeks = (i: number) => {
    if (i < visForslag.length) velg({ type: "brreg", orgnr: visForslag[i].orgnr, navn: tittel(visForslag[i].navn) });
    else velg({ type: "fritekst", navn: tekst.trim() });
  };

  function tast(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setApen(true);
      setAktiv((a) => (a + 1) % Math.max(alternativer, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((a) => (a <= 0 ? alternativer - 1 : a - 1));
    } else if (e.key === "Enter" && apen && aktiv >= 0) {
      e.preventDefault();
      velgIndeks(aktiv);
    } else if (e.key === "Escape") setApen(false);
  }

  if (valg) {
    return (
      <div className="rounded-lg border border-neutral-300 p-4 text-sm">
        <p className="text-neutral-500">Selger</p>
        <p className="mt-1 font-medium">
          {valg.type === "privat" ? "Privatperson" : valg.navn}
          {valg.type === "brreg" && <span className="ml-2 font-normal text-neutral-500">org.nr {valg.orgnr}</span>}
          {valg.type === "fritekst" && <span className="ml-2 font-normal text-neutral-500">ikke koblet til Enhetsregisteret</span>}
        </p>
        <button
          onClick={() => {
            setValg(null);
            setTekst("");
          }}
          className="mt-3 text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
        >
          Endre
        </button>
      </div>
    );
  }

  return (
    <div className="relative text-sm">
      <label htmlFor={id} className="mb-1 block font-medium">
        Hvem solgte bilen?
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={apen && alternativer > 0}
        aria-controls={`${id}-liste`}
        aria-activedescendant={aktiv >= 0 ? `${id}-${aktiv}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        value={tekst}
        placeholder="Skriv firmanavn, f.eks. Arendal Bil"
        onChange={(e) => {
          setTekst(e.target.value);
          setApen(true);
        }}
        onFocus={() => setApen(true)}
        onBlur={() => setTimeout(() => setApen(false), 120)}
        onKeyDown={tast}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
      />
      {apen && alternativer > 0 && (
        <ul id={`${id}-liste`} role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-md">
          {visForslag.map((f, i) => (
            <li
              key={f.orgnr}
              id={`${id}-${i}`}
              role="option"
              aria-selected={aktiv === i}
              onMouseDown={() => velgIndeks(i)}
              onMouseEnter={() => setAktiv(i)}
              className={`cursor-pointer px-3 py-2 ${aktiv === i ? "bg-neutral-100" : ""}`}
            >
              <span className="font-medium">{tittel(f.navn)}</span>
              {f.status && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">{f.status}</span>}
              <span className="block text-xs text-neutral-500">
                {[f.kommune && tittel(f.kommune), f.bransje, `org.nr ${f.orgnr}`].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
          <li
            id={`${id}-${visForslag.length}`}
            role="option"
            aria-selected={aktiv === visForslag.length}
            onMouseDown={() => velgIndeks(visForslag.length)}
            onMouseEnter={() => setAktiv(visForslag.length)}
            className={`cursor-pointer border-t border-neutral-200 px-3 py-2 ${aktiv === visForslag.length ? "bg-neutral-100" : ""}`}
          >
            {laster ? "Søker …" : visForslag.length ? "Fant ikke firmaet?" : "Ingen treff."} Bruk «{tekst.trim()}» som skrevet
          </li>
        </ul>
      )}
      <button onClick={() => velg({ type: "privat" })} className="mt-2 text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
        Selger var en privatperson
      </button>
    </div>
  );
}
