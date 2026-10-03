"use client";

import { useId, useState } from "react";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";

// The registration number is looked up in Statens vegvesen's registry. The vehicle is what the
// assessment and the letter are about, so it is chosen first, and it cannot be changed once the
// letter is bought. Nothing is stored on the server here. This sits inside the assessment's own
// form, so it has no form of its own: Enter looks the vehicle up instead of going to the next step.

const LABEL = "font-ui text-[14px] font-semibold text-[#17263d] md:text-[15px]";

// `funnet` gets the vehicle, and the day it was registered on its current owner when the registry has it.
export function Regnr({ kjoretoy, funnet }: { kjoretoy: Kjoretoy | null; funnet: (k: Kjoretoy | null, eierFra?: string | null) => void }) {
  const id = useId();
  const [regnr, setRegnr] = useState("");
  const [henter, setHenter] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function hent() {
    if (!regnr.trim() || henter) return;
    setHenter(true);
    setFeil(null);
    try {
      const res = await fetch(`/api/kjoretoy?${new URLSearchParams({ regnr })}`);
      const json = (await res.json()) as { kjoretoy?: Kjoretoy; eierFra?: string | null; feil?: string };
      if (!res.ok || !json.kjoretoy) throw new Error(json.feil ?? "Noe gikk galt. Prøv igjen.");
      setRegnr("");
      funnet(json.kjoretoy, json.eierFra ?? null);
    } catch (e) {
      setFeil(e instanceof Error && !(e instanceof TypeError) ? e.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      setHenter(false);
    }
  }

  if (kjoretoy) {
    return (
      <div className="flex flex-col gap-2.5 md:max-w-[440px] md:gap-3">
        <span className={LABEL}>Registreringsnummer</span>
        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-[#bfbab0] bg-white p-[14px]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-kode text-[15px] tracking-[.04em] text-[#17263d]">{kjoretoy.regnr}</span>
            <span role="status" className="text-[13px] leading-[1.4] text-[#1f5a45]">
              {[`${kjoretoy.merke} ${kjoretoy.modell}`, kjoretoy.ar, "hentet fra Statens vegvesen"].filter(Boolean).join(" · ")}
            </span>
          </div>
          <button type="button" onClick={() => funnet(null)} className="whitespace-nowrap text-[14px] font-medium text-[#5b6472]">
            Endre
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 md:max-w-[440px] md:gap-3">
      <label htmlFor={id} className={LABEL}>
        Registreringsnummer
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          aria-invalid={feil ? true : undefined}
          value={regnr}
          onChange={(e) => setRegnr(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void hent();
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          placeholder="AB 12345"
          className="min-w-0 flex-1 rounded-[6px] border border-[#bfbab0] bg-white p-[14px] font-kode text-[16px] tracking-[.06em] text-[#17263d] outline-none placeholder:text-[#8a94a3] focus:border-[#17263d] focus:shadow-[0_0_0_.5px_#17263d]"
        />
        <button
          type="button"
          onClick={() => void hent()}
          disabled={!regnr.trim() || henter}
          className="whitespace-nowrap rounded-[6px] bg-[#17263d] px-[18px] font-ui text-[14px] font-semibold text-[#f6f4ef] disabled:bg-[#dcd8cf] disabled:text-[#8a94a3]"
        >
          {henter ? "Henter …" : "Hent bilen"}
        </button>
      </div>
      {feil && (
        <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
          {feil}
        </p>
      )}
    </div>
  );
}

// The car the letter is written for, shown before the buyer pays. It cannot be changed here: the
// vehicle is fixed once the letter is bought, so the buyer checks it now. The registry has no model
// year, only the year the vehicle was first registered, and that is what is shown.
export function Bilkort({ kjoretoy }: { kjoretoy: Kjoretoy }) {
  return (
    <div role="group" aria-label="Brevet skrives for" className="flex flex-col gap-1 rounded-[6px] bg-[#f6f4ef] p-4 text-[#17263d]">
      <span className="text-[12px] font-medium uppercase tracking-[.04em] text-[#5b6472]">Brevet skrives for</span>
      <span className="font-kode text-[22px] font-medium tracking-[.06em]">{kjoretoy.regnr}</span>
      <span className="text-[16px] font-semibold leading-[1.3]">
        {kjoretoy.merke} {kjoretoy.modell}
      </span>
      {kjoretoy.ar && <span className="text-[13px] text-[#5b6472]">Første gang registrert {kjoretoy.ar}</span>}
      <span className="pt-1 text-[13px] leading-[1.5] text-[#5b6472]">Bilen kan ikke byttes etter kjøpet. Er det feil bil, endrer du svarene først.</span>
    </div>
  );
}
