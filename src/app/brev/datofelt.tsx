"use client";

import { useId, useRef, useState } from "react";
import { nb } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { norskDato } from "@/lib/brev/brev";
import { erDato } from "@/lib/vurdering/faktorer";

// The one date field: the buyer types dd.mm.åååå or picks a day in the calendar. The value in and out
// is ÅÅÅÅ-MM-DD, or "" while the text is not a whole date within `min`–`max`, so the steps check and
// store dates as before. Dates are worked out in local time only: `toISOString` would move a day in
// Norway.

const pad = (n: number) => String(n).padStart(2, "0");
const isoFra = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const datoFra = (iso: string) => {
  const [ar, maned, dag] = iso.split("-").map(Number);
  return new Date(ar, maned - 1, dag);
};
const norskKort = (iso: string) => (erDato(iso) ? iso.split("-").reverse().join(".") : "");

// «12.3.2024» and «12.03.2024» as ÅÅÅÅ-MM-DD; null when it is not a real day.
function lesNorsk(tekst: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(tekst.trim());
  if (!m) return null;
  const iso = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return erDato(iso) ? iso : null;
}

// Puts in the dots while the buyer types digits; deleting is left alone. Eight digits in one go
// (pasted, or filled by a test) become a whole date.
function medPunktum(ny: string, gammel: string): string {
  if (ny.length < gammel.length) return ny;
  const rent = ny.replace(/[^\d.]/g, "");
  if (/^\d{8}$/.test(rent)) return `${rent.slice(0, 2)}.${rent.slice(2, 4)}.${rent.slice(4)}`;
  if (/^\d{2}$/.test(rent) || /^\d{1,2}\.\d{2}$/.test(rent)) return `${rent}.`;
  return rent.slice(0, 10);
}

function feilFor(tekst: string, min: string | undefined, max: string): string | null {
  if (!/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(tekst.trim())) return null;
  const iso = lesNorsk(tekst);
  if (!iso) return "Det er ikke en gyldig dato. Skriv den som dd.mm.åååå.";
  if (min && iso < min) return `Datoen kan ikke være før ${norskDato(min)}.`;
  if (iso > max) return `Datoen kan ikke være etter ${norskDato(max)}.`;
  return null;
}

export function Datofelt({
  label,
  hjelp,
  verdi,
  settVerdi,
  min,
  max,
}: {
  label: string;
  hjelp?: string;
  verdi: string;
  settVerdi: (iso: string) => void;
  min?: string;
  max: string;
}) {
  const id = useId();
  const felt = useRef<HTMLInputElement>(null);
  const [tekst, setTekst] = useState(() => norskKort(verdi));
  const [apen, setApen] = useState(false);
  // A value set from outside (the calendar, or a suggestion) is shown in the field. "" is what the
  // field itself sends while the text is unfinished, so it leaves the text alone.
  const [forrige, setForrige] = useState(verdi);
  if (verdi !== forrige) {
    setForrige(verdi);
    if (verdi && verdi !== lesNorsk(tekst)) setTekst(norskKort(verdi));
  }

  const iRom = (iso: string | null) => iso !== null && (!min || iso >= min) && iso <= max;
  const skriv = (t: string) => {
    const ny = medPunktum(t, tekst);
    const iso = lesNorsk(ny);
    setTekst(ny);
    setForrige(iRom(iso) ? iso! : "");
    settVerdi(iRom(iso) ? iso! : "");
  };
  const velg = (d: Date | undefined) => {
    if (!d) return;
    const iso = isoFra(d);
    setTekst(norskKort(iso));
    setForrige(iso);
    settVerdi(iso);
    setApen(false);
  };

  const feil = feilFor(tekst, min, max);
  const valgt = verdi ? datoFra(verdi) : undefined;
  const sist = datoFra(max);
  const forst = min ? datoFra(min) : new Date(sist.getFullYear() - 20, 0, 1);
  const beskrevet = [hjelp && `${id}-hjelp`, feil && `${id}-feil`].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={feil ? true : undefined} className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          ref={felt}
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd.mm.åååå"
          value={tekst}
          onChange={(e) => skriv(e.target.value)}
          onBlur={() => {
            const iso = lesNorsk(tekst);
            if (iso) setTekst(norskKort(iso));
          }}
          aria-invalid={feil ? true : undefined}
          aria-describedby={beskrevet}
          className="pr-12"
        />
        <Popover open={apen} onOpenChange={setApen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Velg dato i kalender" className="absolute top-1/2 right-1 -translate-y-1/2">
              <CalendarIcon />
            </Button>
          </PopoverTrigger>
          {/* Focus goes to the field, where the picked date now stands, once the calendar has closed.
              Radix would move it back to the button while the popover unmounts, inside React's commit. */}
          <PopoverContent
            className="w-auto p-0"
            align="end"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              requestAnimationFrame(() => felt.current?.focus());
            }}
          >
            <Calendar
              mode="single"
              locale={nb}
              captionLayout="dropdown"
              selected={valgt}
              onSelect={velg}
              defaultMonth={valgt ?? sist}
              startMonth={forst}
              endMonth={sist}
              disabled={[{ before: forst }, { after: sist }]}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {hjelp && (
        <FieldDescription id={`${id}-hjelp`} className="m-0 text-[13px] leading-[1.5]">
          {hjelp}
        </FieldDescription>
      )}
      {feil && (
        <FieldError id={`${id}-feil`} className="text-[13px] leading-[1.5]">
          {feil}
        </FieldError>
      )}
    </Field>
  );
}
