"use client";

import { useState } from "react";
import { ForhandlerVelger } from "@/app/vurdering/forhandler-velger";
import type { Forhandler } from "@/lib/vurdering/typer";

const gruppertOrgnr = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

// The dealer is found in Brreg by name or organisation number; choosing a suggestion is enough. A
// dealer missing from the register (or a sole proprietorship, which we leave out) can be used as typed.
export function ForhandlerFelt({ forhandler, funnet, tittelId }: { forhandler: Forhandler | null; funnet: (f: Forhandler | null) => Promise<boolean>; tittelId: string }) {
  const [utkast, setUtkast] = useState<Forhandler>({ type: "fritekst", navn: "" });

  if (forhandler) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium">{forhandler.navn}</span>
          <span className="text-[13px] leading-[1.4] text-[#1f5a45]">
            {forhandler.type === "brreg" ? `Koblet til Enhetsregisteret · org.nr ${gruppertOrgnr(forhandler.orgnr)}` : "Ikke koblet til Enhetsregisteret"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setUtkast({ type: "fritekst", navn: forhandler.navn });
            funnet(null);
          }}
          className="whitespace-nowrap text-[14px] font-medium text-[#5b6472]"
        >
          Endre
        </button>
      </div>
    );
  }

  const navn = utkast.navn.trim();
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">Skriv navnet på forhandleren eller organisasjonsnummeret. Vi finner firmaet i Enhetsregisteret.</p>
      <div role="group" aria-labelledby={tittelId}>
        <ForhandlerVelger
          value={utkast}
          onChange={(v) => (v.type === "brreg" ? funnet(v) : setUtkast(v))}
          inputClass="w-full rounded-[6px] border-[1.5px] border-[#17263d] bg-white px-3.5 py-3 text-[16px] placeholder:text-[#8a94a3]"
          labelClass="sr-only"
          placeholder="Navn eller org.nr."
        />
      </div>
      <button
        type="button"
        disabled={navn.length < 2}
        onClick={() => funnet({ type: "fritekst", navn })}
        className="self-start rounded-[6px] border border-[#bfbab0] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#17263d] disabled:text-[#8a94a3]"
      >
        {navn.length >= 2 ? `Bruk «${navn.length > 24 ? `${navn.slice(0, 24)}…` : navn}» som skrevet` : "Bruk som skrevet"}
      </button>
    </div>
  );
}
