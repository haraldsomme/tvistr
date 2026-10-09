import { useEffect, useState } from "react";
import { type Forslag, tittel } from "@/lib/brreg";
import type { BrregTreff } from "@/lib/skjema/skjema";
import { Tekst } from "./felt";

const orgnr = (s: string) => s.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

export const tilTreff = (f: Forslag): BrregTreff => ({
  foretaksnavn: tittel(f.navn),
  organisasjonsnummer: orgnr(f.orgnr),
  forretningsadresse: f.forretningsadresse ?? "",
});

// Questions 6–6c: the name the buyer types, suggestions from Brønnøysund (/api/firma, which leaves
// out sole proprietorships on purpose) and a confirmation. Without a confirmed match the form goes
// on with the typed name only.
export function Forhandlervelger({
  navn,
  treff,
  bekreftet,
  onNavn,
  onTreff,
}: {
  navn: string;
  treff: BrregTreff | null;
  bekreftet: boolean;
  onNavn: (v: string) => void;
  onTreff: (t: BrregTreff | null, bekreftet: boolean) => void;
}) {
  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [status, setStatus] = useState<"" | "soker" | "feil">("");
  const [soktPa, setSoktPa] = useState("");

  useEffect(() => {
    const q = navn.trim();
    if (treff || (q.length < 3 && !/^\d{9}$/.test(q.replace(/\s/g, "")))) return;
    const avbryt = new AbortController();
    const t = setTimeout(async () => {
      setStatus("soker");
      try {
        const res = await fetch(`/api/firma?${new URLSearchParams({ q })}`, { signal: avbryt.signal });
        const json = (await res.json()) as { forslag: Forslag[]; feil?: true };
        setForslag(json.forslag);
        setSoktPa(q);
        setStatus(json.feil ? "feil" : "");
      } catch {
        if (!avbryt.signal.aborted) setStatus("feil");
      }
    }, 350);
    return () => {
      clearTimeout(t);
      avbryt.abort();
    };
  }, [navn, treff]);

  if (treff) {
    return (
      <div className="flex flex-col gap-3 rounded-[6px] border border-[#cfcac0] bg-white px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-[#17263d]">{treff.foretaksnavn}</span>
          <span className="font-kode text-[14px] text-[#5b6472]">Org.nr. {treff.organisasjonsnummer}</span>
          {treff.forretningsadresse && <span className="text-[14px] text-[#5b6472]">{treff.forretningsadresse}</span>}
        </div>
        {bekreftet ? (
          <div className="flex items-center justify-between gap-3 text-[15px]">
            <span className="text-[#2d6a3e]">✓ Bekreftet</span>
            <button type="button" onClick={() => onTreff(null, false)} className="text-[#1f3a5f] underline underline-offset-2">
              Endre
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-medium text-[#17263d]">Er dette riktig firma?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => onTreff(treff, true)} className="rounded-[6px] bg-[#17263d] px-4 py-2.5 text-[15px] font-semibold text-[#f6f4ef]">
                Ja, det stemmer
              </button>
              <button type="button" onClick={() => onTreff(null, false)} className="rounded-[6px] border border-[#cfcac0] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#17263d]">
                Nei
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Tekst verdi={navn} onChange={onNavn} etikett="Firmanavn" autoComplete="organization" placeholder="Firmanavn eller organisasjonsnummer" />
      {status === "soker" && <span className="text-[14px] text-[#5b6472]">Søker i Brønnøysundregistrene …</span>}
      {status === "feil" && <span className="text-[14px] text-[#5b6472]">Fikk ikke svar fra Brønnøysundregistrene. Du kan gå videre med navnet du har skrevet.</span>}
      {forslag.length > 0 && soktPa === navn.trim() && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Treff i Brønnøysundregistrene">
          {forslag.map((f) => (
            <li key={f.orgnr}>
              <button
                type="button"
                onClick={() => onTreff(tilTreff(f), false)}
                className="flex w-full flex-col items-start gap-0.5 rounded-[6px] border border-[#cfcac0] bg-white px-4 py-3 text-left hover:border-[#1f3a5f]"
              >
                <span className="text-[16px] font-medium text-[#17263d]">{tittel(f.navn)}</span>
                <span className="text-[14px] text-[#5b6472]">
                  {orgnr(f.orgnr)}
                  {f.kommune && ` · ${tittel(f.kommune)}`}
                  {f.status && ` · ${f.status === "konkurs" ? "konkurs" : "under avvikling"}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {soktPa === navn.trim() && status === "" && forslag.length === 0 && (
        <span className="text-[14px] text-[#5b6472]">Ingen treff. Du kan gå videre med navnet du har skrevet.</span>
      )}
    </div>
  );
}
