"use client";

import { useId, useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import {
  FEILTYPER_KNAPPER,
  forsteUgyldigeSteg,
  FRA_AR,
  JA_NEI,
  medKjopsalder,
  medKjopsdato,
  oppdagetMulig,
  OPPLYST_VALG,
  sporOmFemarsfrist,
  type Innsending,
} from "@/lib/vurdering/innsending";
import {
  FEILOPPLYSNING_VALG,
  KJOPSALDER_VALG,
  KJOPSFORM_VALG,
  KONTAKT_VALG,
  OPPDAGET_VALG,
  type FeilOpplysning,
} from "@/lib/vurdering/typer";
import {
  FEILTYPE_TEKST,
  JA_NEI_TEKST,
  KJOPSALDER_TEKST,
  KJOPSFORM_TEKST,
  KONTAKT_TEKST,
  OPPDAGET_TEKST,
  OPPLYST_TEKST,
  SPORSMAL,
} from "@/app/vurdering/tekster";
import {
  bareSiffer,
  gruppert,
  HJELP,
  kroner,
  LABEL,
  Nedtrekk,
  Sammendrag,
  Skjema,
  Tekstfelt,
} from "./felt";

// The answers from the assessment, as they stand in the letter. The buyer can correct them here after
// the letter is bought: the vehicle cannot be changed, everything else can. A change that makes the
// deadline pass is saved all the same (see PUT /api/sak/[id]/svar); the page then says so.

const FEILOPPLYSNING_TEKST: Record<FeilOpplysning, string> = {
  nei: "Nei",
  ja_dokumentert: "Ja, og jeg har det skriftlig",
  ja_udokumentert: "Ja, men ikke skriftlig",
};

// What the form below shows when it is closed: the answers that decide the letter, in a few lines.
function Oppsummering({ svar, kjoretoy }: { svar: Innsending; kjoretoy: Kjoretoy | undefined }) {
  const bil = kjoretoy && `${kjoretoy.merke} ${kjoretoy.modell}${kjoretoy.ar ? ` (${kjoretoy.ar})` : ""}, ${kjoretoy.regnr}`;
  const bevis = [svar.verkstedrapport === "ja" && "verkstedrapport", svar.bilder === "ja" && "bilder eller video av feilen"].filter(Boolean).join(" og ");
  return (
    <Sammendrag
      linjer={[
        bil && `${bil} (kan ikke endres)`,
        `Kjøpt ${svar.kjopsdato ? norskDato(svar.kjopsdato) : svar.kjopAlder ? KJOPSALDER_TEKST[svar.kjopAlder].toLowerCase() : ""}${svar.kjopesum ? ` for ${kroner(Number(svar.kjopesum))}` : ""}${svar.kmVedKjop ? `, ${gruppert(svar.kmVedKjop)} km` : ""}`,
        (!svar.kjopesum || !svar.kjopsdato) && `${[!svar.kjopsdato && "Kjøpsdatoen", !svar.kjopesum && "kjøpesummen"].filter(Boolean).join(" og ")} mangler. Legg ${!svar.kjopsdato && !svar.kjopesum ? "dem" : "den"} inn under «Endre svar», ellers står det som felt i brevet.`,
        `Feil: ${[...new Set(svar.feiltyper)].map((t) => FEILTYPE_TEKST[t].toLowerCase()).join(", ")}`,
        svar.oppdaget &&
          `Viste seg: ${OPPDAGET_TEKST[svar.oppdaget].toLowerCase()} etter kjøpet`,
        svar.kontakt &&
          `Tatt opp med forhandleren: ${KONTAKT_TEKST[svar.kontakt].toLowerCase()}`,
        bevis && `Bevis: ${bevis}`,
      ]}
    />
  );
}

function Svarskjema({ start, idag, lagre, avbryt }: { start: Innsending; idag: string; lagre: (svar: Innsending) => Promise<boolean>; avbryt?: () => void }) {
  const id = useId();
  const [d, setD] = useState(start);
  const sett = <K extends keyof Innsending>(k: K, v: Innsending[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <Skjema klar={forsteUgyldigeSteg(d, idag) === null} send={() => lagre(d)} avbryt={avbryt}>
      <p className={HJELP}>Brevet bygges av disse svarene og oppdateres når du lagrer. Bilen kan ikke byttes etter kjøpet.</p>
      <Tekstfelt label={SPORSMAL.kjopsdato} type="date" min={`${FRA_AR}-01-01`} max={idag} value={d.kjopsdato} onChange={(e) => setD((x) => medKjopsdato(x, e.target.value, idag))} />
      <Nedtrekk label={SPORSMAL.kjopAlder} value={d.kjopAlder} onChange={(e) => setD((x) => medKjopsalder(x, e.target.value as Innsending["kjopAlder"], idag))}>
        <option value="">Velg</option>
        {KJOPSALDER_VALG.map((v) => (
          <option key={v} value={v}>
            {KJOPSALDER_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      <Nedtrekk
        label={SPORSMAL.kjopsform}
        value={d.kjopsform}
        onChange={(e) =>
          sett("kjopsform", e.target.value as Innsending["kjopsform"])
        }
      >
        <option value="">Velg</option>
        {KJOPSFORM_VALG.map((v) => (
          <option key={v} value={v}>
            {KJOPSFORM_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      <Tekstfelt
        label={SPORSMAL.kjopesum}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Kroner"
        value={gruppert(d.kjopesum)}
        onChange={(e) => sett("kjopesum", bareSiffer(e.target.value))}
      />
      <Tekstfelt
        label={SPORSMAL.kmVedKjop}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Kilometer"
        value={gruppert(d.kmVedKjop)}
        onChange={(e) => sett("kmVedKjop", bareSiffer(e.target.value))}
      />
      <div
        role="group"
        aria-labelledby={`${id}-feiltype`}
        className="flex flex-col gap-1.5"
      >
        <span id={`${id}-feiltype`} className={LABEL}>
          {SPORSMAL.feiltype}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {FEILTYPER_KNAPPER.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={d.feiltyper.includes(f)}
              onClick={() => sett("feiltyper", d.feiltyper.includes(f) ? d.feiltyper.filter((x) => x !== f) : [...d.feiltyper, f])}
              className={`rounded-full px-3 py-2 text-[13px] font-medium ${d.feiltyper.includes(f) ? "bg-[#17263d] text-[#f6f4ef]" : "border border-[#bfbab0] bg-white text-[#17263d]"}`}
            >
              {FEILTYPE_TEKST[f]}
            </button>
          ))}
        </div>
      </div>
      <Nedtrekk label={SPORSMAL.oppdaget} value={d.oppdaget} onChange={(e) => sett("oppdaget", e.target.value as Innsending["oppdaget"])}>
        <option value="">Velg</option>
        {OPPDAGET_VALG.map((v) => (
          <option key={v} value={v} disabled={!oppdagetMulig(d, v, idag)}>
            {OPPDAGET_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      <Nedtrekk label={SPORSMAL.opplyst} value={d.opplystForKjop} onChange={(e) => sett("opplystForKjop", e.target.value as Innsending["opplystForKjop"])}>
        <option value="">Velg</option>
        {OPPLYST_VALG.map((v) => (
          <option key={v} value={v}>
            {OPPLYST_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      <Nedtrekk label={SPORSMAL.feilopplysning} value={d.feilOpplysning} onChange={(e) => sett("feilOpplysning", e.target.value as Innsending["feilOpplysning"])}>
        <option value="">Velg</option>
        {FEILOPPLYSNING_VALG.map((v) => (
          <option key={v} value={v}>
            {FEILOPPLYSNING_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      <Nedtrekk label={SPORSMAL.kontakt} value={d.kontakt} onChange={(e) => sett("kontakt", e.target.value as Innsending["kontakt"])}>
        <option value="">Velg</option>
        {KONTAKT_VALG.map((v) => (
          <option key={v} value={v}>
            {KONTAKT_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      {sporOmFemarsfrist(d, idag) && (
        <Nedtrekk label={SPORSMAL.reklamert} value={d.reklamertInnenFemAr} onChange={(e) => sett("reklamertInnenFemAr", e.target.value as Innsending["reklamertInnenFemAr"])}>
          <option value="">Velg</option>
          {JA_NEI.map((v) => (
            <option key={v} value={v}>
              {JA_NEI_TEKST[v]}
            </option>
          ))}
        </Nedtrekk>
      )}
      <Nedtrekk label={SPORSMAL.rapport} value={d.verkstedrapport} onChange={(e) => sett("verkstedrapport", e.target.value as Innsending["verkstedrapport"])}>
        <option value="">Velg</option>
        {JA_NEI.map((v) => (
          <option key={v} value={v}>
            {JA_NEI_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      {d.verkstedrapport === "ja" && (
        <Nedtrekk label={SPORSMAL.rapportSier} value={d.rapportSierForKjop} onChange={(e) => sett("rapportSierForKjop", e.target.value as Innsending["rapportSierForKjop"])}>
          <option value="">Velg</option>
          {JA_NEI.map((v) => (
            <option key={v} value={v}>
              {JA_NEI_TEKST[v]}
            </option>
          ))}
        </Nedtrekk>
      )}
      <Nedtrekk label={SPORSMAL.bilder} value={d.bilder} onChange={(e) => sett("bilder", e.target.value as Innsending["bilder"])}>
        <option value="">Velg</option>
        {JA_NEI.map((v) => (
          <option key={v} value={v}>
            {JA_NEI_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
    </Skjema>
  );
}

// `tvinget` is the message when the answers no longer give a letter (a deadline that has begun to
// matter since they were saved): the form is then open and cannot be cancelled.
export function SvarKort({ svar, kjoretoy, idag, tvinget, lagre }: { svar: Innsending; kjoretoy: Kjoretoy | undefined; idag: string; tvinget: string | null; lagre: (svar: Innsending) => Promise<boolean> }) {
  // Without the price the letter has a gap in its first sentence, so the form is open from the start.
  const [apen, setApen] = useState(!svar.kjopesum || !svar.kjopsdato);
  const tittelId = useId();
  const redigerer = apen || tvinget !== null;
  return (
    <section aria-labelledby={tittelId} className="flex flex-col gap-2.5 rounded-lg border border-[#dcd8cf] bg-white px-[18px] py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={tittelId} className="m-0 text-[14px] font-semibold">
          Svarene fra vurderingen
        </h3>
        {!redigerer && (
          <button type="button" onClick={() => setApen(true)} className="whitespace-nowrap text-[14px] font-medium text-[#5b6472]">
            Endre svar
          </button>
        )}
      </div>
      {tvinget && (
        <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
          {tvinget}
        </p>
      )}
      {redigerer ? (
        <Svarskjema
          start={svar}
          idag={idag}
          lagre={async (nye) => {
            const ok = await lagre(nye);
            if (ok) setApen(false);
            return ok;
          }}
          avbryt={tvinget ? undefined : () => setApen(false)}
        />
      ) : (
        <Oppsummering svar={svar} kjoretoy={kjoretoy} />
      )}
    </section>
  );
}
