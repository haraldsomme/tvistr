import { useState } from "react";
import { MOMENTER, moment as finn } from "@/lib/brev/momenter";
import { MOMENT_EGEN_MAKS, type Momentsvar } from "@/lib/brev/utfylling";
import { Tekstfelt, Valgfelt, type Alternativ } from "../felt";

// The moments a step asks (`steg` in momenter.ts): which ones apply to the case (`momenterFor`, worked out
// in liste.tsx) and what is saved. The answers of all steps are saved together in `utfylling.momenter`, so
// a step saves its own over the others'.
export type Momenter = { aktuelle: readonly string[]; lagret: Momentsvar | undefined };
type Svar = NonNullable<Momentsvar[string]>;

export const moment = (id: string) => finn(id)!;

// The alternatives are examples of an answer; the buyer can also answer in their own words.
export const EGEN = "__egen__";
export const EGEN_VALG = { verdi: EGEN, tekst: "Egen beskrivelse", hjelp: "Skriv med dine egne ord." };

export function useMomenter({ aktuelle, lagret }: Momenter) {
  const [svar, setSvar] = useState<Momentsvar>(lagret ?? {});
  const sett = (id: string, s: Svar | null) =>
    setSvar((x) => {
      const ny = { ...x };
      if (s) ny[id] = s;
      else delete ny[id];
      return ny;
    });
  return {
    svar,
    sett,
    // Whether the case asks this moment.
    gjelder: (id: string) => aktuelle.includes(id),
    // What to save: the answers to `viste` (the moments this step shows now) over the other steps'
    // answers, and this step's other moments cleared, so a question that no longer applies leaves nothing.
    lagring: (steg: string, viste: string[]): Momentsvar | null => {
      const ny: Momentsvar = { ...lagret };
      for (const m of MOMENTER.filter((x) => x.steg === steg)) {
        const s = svar[m.id];
        if (viste.includes(m.id) && (s?.svar || s?.egen?.trim())) ny[m.id] = s;
        else delete ny[m.id];
      }
      return Object.keys(ny).length ? ny : null;
    },
  };
}

// A moment's own question and alternatives, with «Egen beskrivelse» last. `valg` puts other words on the
// alternatives when the step asks a yes-or-no question (the alternatives are still what is saved); such a
// question has no own words.
export function MomentFelt({ id, svar, sett, label, hjelp, valg }: { id: string; svar: Momentsvar; sett: (id: string, s: Svar | null) => void; label?: string; hjelp?: string; valg?: Alternativ<string>[] }) {
  const m = moment(id);
  const s = svar[id];
  const valgt = s?.egen !== undefined ? EGEN : (s?.svar ?? "");
  return (
    <div className="flex flex-col gap-2">
      <Valgfelt
        label={label ?? m.sporsmal}
        hjelp={hjelp}
        verdi={valgt}
        velg={(v) => sett(id, v === EGEN ? { egen: "" } : { svar: v })}
        valg={valg ?? [...m.alternativer.map((a) => ({ verdi: a, tekst: a })), EGEN_VALG]}
      />
      {valgt === EGEN && <Tekstfelt label="Ditt svar" autoFocus value={s?.egen ?? ""} onChange={(e) => sett(id, { egen: e.target.value.slice(0, MOMENT_EGEN_MAKS) })} />}
    </div>
  );
}
