import { useEffect, useId, useRef, useState } from "react";
import { type Forslag, tittel } from "@/lib/brreg";
import type { BrregTreff } from "@/lib/skjema/skjema";

const gruppertOrgnr = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

export const tilTreff = (f: Forslag): BrregTreff => ({
  foretaksnavn: tittel(f.navn),
  organisasjonsnummer: gruppertOrgnr(f.orgnr),
  forretningsadresse: f.forretningsadresse ?? "",
});

// Questions 6–6c (docs/skjema.md): the dealer by name or organisation number, with suggestions from
// Brønnøysund (/api/firma, which leaves out sole proprietorships on purpose). Picking a suggestion is
// the confirmation (treff_bekreftet); typing again unlinks it. A dealer missing from the register
// stays the typed name with no match. Rebuilt from the earlier letter page's dealer picker.
export function Forhandlervelger({
  navn,
  treff,
  onChange,
  inputClass,
  labelClass,
}: {
  navn: string;
  treff: BrregTreff | null;
  onChange: (v: { firmanavn_oppgitt: string | null; bronnoysund_treff: BrregTreff | null; treff_bekreftet: boolean }) => void;
  inputClass: string;
  labelClass: string;
}) {
  const id = useId();
  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [apen, setApen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const abort = useRef<AbortController | null>(null);

  const sok = !treff && navn.trim().length >= 3;
  const liste = sok ? forslag : [];

  useEffect(() => {
    abort.current?.abort();
    if (!sok) return;
    const ac = new AbortController();
    abort.current = ac;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/firma?q=${encodeURIComponent(navn.trim())}`, { signal: ac.signal });
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
  }, [navn, sok]);

  const velg = (i: number) => {
    const f = liste[i];
    if (!f) return;
    const t = tilTreff(f);
    onChange({ firmanavn_oppgitt: t.foretaksnavn, bronnoysund_treff: t, treff_bekreftet: true });
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
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        Hva heter firmaet du kjøpte av?
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={visListe}
        aria-controls={`${id}-liste`}
        aria-activedescendant={visListe && aktiv >= 0 ? `${id}-${aktiv}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Firmanavn eller organisasjonsnummer"
        className={inputClass}
        value={navn}
        onChange={(e) => {
          onChange({ firmanavn_oppgitt: e.target.value.slice(0, 120) || null, bronnoysund_treff: null, treff_bekreftet: false });
          setApen(true);
        }}
        onFocus={() => setApen(true)}
        onBlur={() => setTimeout(() => setApen(false), 120)}
        onKeyDown={tast}
      />
      {treff && (
        <div className="text-[13px] leading-[1.4] text-[#1f5a45]">
          Koblet til Enhetsregisteret · org.nr {treff.organisasjonsnummer}
          {treff.forretningsadresse && ` · ${treff.forretningsadresse}`}
        </div>
      )}
      {visListe && (
        <ul
          id={`${id}-liste`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[6px] border border-[#bfbab0] bg-white shadow-[0_8px_24px_-12px_rgba(23,38,61,.35)]"
        >
          {liste.map((f, i) => (
            <li
              key={f.orgnr}
              id={`${id}-${i}`}
              role="option"
              aria-selected={aktiv === i}
              onMouseDown={() => velg(i)}
              onMouseEnter={() => setAktiv(i)}
              className={`cursor-pointer px-3.5 py-3 ${aktiv === i ? "bg-[#f6f4ef]" : ""} ${i > 0 ? "border-t border-[#eceae4]" : ""}`}
            >
              <span className="text-[15px] font-semibold text-[#17263d]">{tittel(f.navn)}</span>
              {f.status && <span className="ml-2 rounded bg-[oklch(0.95_0.03_25)] px-1.5 py-0.5 text-[12px] text-[oklch(0.42_0.12_25)]">{f.status}</span>}
              <span className="mt-0.5 block text-[13px] leading-[1.4] text-[#5b6472]">
                {[f.kommune && tittel(f.kommune), `org.nr ${gruppertOrgnr(f.orgnr)}`].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
