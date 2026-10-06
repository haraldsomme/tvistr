"use client";

import { Button } from "@/components/ui/button";
import { useContext, useState } from "react";
import { Skjema, Tekstfelt, VeiviserKontekst } from "../felt";
import { ForhandlerVelger } from "@/app/vurdering/forhandler-velger";
import type { Forhandler } from "@/lib/vurdering/typer";

const gruppertOrgnr = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

// The dealer is found in Brreg by name or organisation number; choosing a suggestion is enough. A
// dealer missing from the register (or a sole proprietorship, which we leave out) can be used as typed.
export function ForhandlerFelt({ forhandler, funnet, tittelId }: { forhandler: Forhandler | null; funnet: (f: Forhandler | null) => Promise<boolean>; tittelId: string }) {
  const [utkast, setUtkast] = useState<Forhandler>({ type: "fritekst", navn: "" });
  // The address of a dealer typed freely: street, postcode and place. All three, or none.
  const [gate, setGate] = useState("");
  const [postnummer, setPostnummer] = useState("");
  const [poststed, setPoststed] = useState("");
  const veiviser = useContext(VeiviserKontekst);

  if (forhandler) {
    const visning = (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium">{forhandler.navn}</span>
          <span className="text-[13px] leading-[1.4] text-[#1f5a45]">
            {forhandler.type === "brreg" ? `Koblet til Enhetsregisteret · org.nr ${gruppertOrgnr(forhandler.orgnr)}` : "Ikke koblet til Enhetsregisteret"}
          </span>
          {forhandler.type === "fritekst" && forhandler.adresse && (
            <span className="text-[13px] leading-[1.4] text-[#5b6472]">{`${forhandler.adresse.linjer.join(", ")}, ${forhandler.adresse.postnummer} ${forhandler.adresse.poststed}`}</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setUtkast({ type: "fritekst", navn: forhandler.navn });
            if (forhandler.type === "fritekst" && forhandler.adresse) {
              setGate(forhandler.adresse.linjer.join(", "));
              setPostnummer(forhandler.adresse.postnummer);
              setPoststed(forhandler.adresse.poststed);
            }
            funnet(null);
          }}
          className="text-[14px] font-medium"
        >
          Endre
        </Button>
      </div>
    );
    if (!veiviser) return visning;
    return (
      <Skjema klar send={async () => true}>
        {visning}
      </Skjema>
    );
  }

  const navn = utkast.navn.trim();
  const tomAdresse = gate.trim() === "" && postnummer === "" && poststed.trim() === "";
  const helAdresse = gate.trim().length >= 2 && /^\d{4}$/.test(postnummer) && poststed.trim() !== "";
  const adresse = helAdresse ? { linjer: [gate.trim()], postnummer, poststed: poststed.trim() } : undefined;
  return (
    <Skjema klar={navn.length >= 2 && (tomAdresse || helAdresse)} send={() => funnet({ type: "fritekst", navn, ...(adresse && { adresse }) })}>
      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">Hvem kjøpte du bilen av? Skriv navnet på forhandleren eller organisasjonsnummeret. Vi finner firmaet i Enhetsregisteret.</p>
        <div role="group" aria-labelledby={tittelId}>
          <ForhandlerVelger
            value={utkast}
            onChange={(v) => (v.type === "brreg" ? funnet(v) : setUtkast(v))}
            labelClass="sr-only"
            placeholder="Navn eller org.nr."
          />
        </div>
        {navn.length >= 2 && (
          <>
            <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">Finner du ikke forhandleren i listen, skriv adressen selv. Den står i brevet som mottakerens adresse.</p>
            <Tekstfelt label="Forhandlerens adresse" autoComplete="off" maxLength={100} value={gate} onChange={(e) => setGate(e.target.value)} />
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <Tekstfelt label="Postnummer" inputMode="numeric" maxLength={4} value={postnummer} onChange={(e) => setPostnummer(e.target.value.replace(/\D/g, ""))} />
              <Tekstfelt label="Sted" maxLength={50} value={poststed} onChange={(e) => setPoststed(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Skjema>
  );
}
