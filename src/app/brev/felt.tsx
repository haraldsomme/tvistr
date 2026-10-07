"use client";

import { createContext, useContext, useId, useState, type FormEvent, type ReactNode } from "react";
import {
  BESKRIVELSE_MAKS,
  BESKRIVELSE_MIN,
  KILDE_MAKS,
  KRAV_TYPER,
  MAKS_UTGIFTER,
  UTGIFT_BESKRIVELSE_MAKS,
  UTGIFT_TYPER,
  gyldigKontonummer,
  kontonummerGruppert,
  kontonummerSiffer,
  type Avsender,
  type Krav,
  type Lagring,
  type Utgift,
} from "@/lib/brev/utfylling";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// The primitives the steps on the letter page share: form chrome, inputs, and formatting. The steps
// themselves live in `./steg/`; `KravFelt` and `AvsenderFelt` stay here because neither is folded into
// another step.

export type Felles = { aktiv: boolean; lagre: (lagring: Lagring) => Promise<boolean>; avbryt?: () => void };

export const LABEL = "text-[13px] font-semibold";
export const HJELP = "m-0 text-[13px] leading-[1.5] text-muted-foreground";

export const kroner = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
export const gruppert = (siffer: string) => siffer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const bareSiffer = (s: string, maks = 8) => s.replace(/\D/g, "").replace(/^0+/, "").slice(0, maks);

export function Sammendrag({ linjer }: { linjer: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-0.5 text-[14px] leading-[1.45] text-[#3d4757]">
      {linjer.filter(Boolean).map((l, n) => (
        <span key={n}>{l}</span>
      ))}
    </div>
  );
}

// Set by the wizard after buying: the form's main button moves on after a save, and «Tilbake» and
// «Hopp over» show beside it.
export type Veiviser = { neste: () => void; tilbake: () => void; hoppOver?: () => void; nesteTekst: string };
export const VeiviserKontekst = createContext<Veiviser | null>(null);
// On mobile the wizard's buttons are fixed to the bottom of the screen, with the step scrolling behind
// them; the wizard's frame leaves room for them (`Ramme` in veiviser.tsx).
export const VEIVISER_KNAPPER = "fixed inset-x-0 bottom-0 z-10 border-t border-[#d3cec3] bg-[#f6f4ef] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0";

// The form of a step: saves on submit and shows the two buttons (in the wizard: «Neste», «Tilbake»
// and «Hopp over»).
export function Skjema({ klar, send, avbryt, children, knapp = "Lagre" }: { klar: boolean; send: () => Promise<boolean>; avbryt?: () => void; children: ReactNode; knapp?: string }) {
  const [lagrer, setLagrer] = useState(false);
  const veiviser = useContext(VeiviserKontekst);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!klar || lagrer) return;
    setLagrer(true);
    const ok = await send();
    setLagrer(false);
    if (ok) veiviser?.neste();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {children}
      <div className={`flex flex-wrap items-center gap-2 ${veiviser ? VEIVISER_KNAPPER : ""}`}>
        {veiviser && (
          <Button type="button" variant="ghost" disabled={lagrer} onClick={veiviser.tilbake}>
            Tilbake
          </Button>
        )}
        <div className={`flex flex-wrap items-center gap-2 ${veiviser ? "ml-auto justify-end" : ""}`}>
          {veiviser?.hoppOver && (
            <Button type="button" variant="link" disabled={lagrer} onClick={veiviser.hoppOver} className="px-2.5">
              Hopp over
            </Button>
          )}
          <Button type="submit" disabled={!klar || lagrer}>
            {lagrer ? (
              <>
                <Spinner aria-hidden data-icon="inline-start" /> Lagrer
              </>
            ) : veiviser && knapp === "Lagre" ? veiviser.nesteTekst : knapp}
          </Button>
          {!veiviser && avbryt && (
            <Button type="button" variant="ghost" onClick={avbryt}>
              Avbryt
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function Tekstfelt({ label, hjelp, feil, ...input }: { label: string; hjelp?: string; feil?: string | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const beskrevet = [hjelp && `${id}-hjelp`, feil && `${id}-feil`].filter(Boolean).join(" ") || undefined;
  return (
    <Field data-invalid={feil ? true : undefined} className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-describedby={beskrevet} aria-invalid={feil ? true : undefined} {...input} />
      {hjelp && (
        <FieldDescription id={`${id}-hjelp`} className={HJELP}>
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

// `deaktivert` greys out an answer that cannot be true given the other answers.
export type Alternativ<T extends string> = { verdi: T; tekst: string; hjelp?: string; deaktivert?: boolean };
export const valgAv = <T extends string>(verdier: readonly T[], tekst: Record<T, string>): Alternativ<T>[] => verdier.map((verdi) => ({ verdi, tekst: tekst[verdi] }));

// The look of one answer: a row with a border, the radio or tick at the left, a title and an
// optional explanation under it. The whole row is the click target; the chosen row is filled.
export const VALGRAD = "min-h-11 cursor-pointer rounded-lg bg-white transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-muted/40 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-white";
const VALGRAD_INNHOLD = "items-start gap-3 px-3.5! py-3!";
const SPORSMAL = "text-[15px] font-semibold";

// A question with a few answers, all shown as rows with one chosen. An answer's `hjelp` is the
// explanation under its title.
export function Valgfelt<T extends string>({
  label,
  hjelp,
  verdi,
  velg,
  valg,
}: {
  label: string;
  hjelp?: string;
  verdi: T | "" | null | undefined;
  velg: (v: T) => void;
  valg: readonly Alternativ<T>[];
}) {
  const id = useId();
  return (
    <FieldSet className="m-0 gap-2 border-0 p-0">
      <FieldLegend id={`${id}-sporsmal`} variant="label" className={`${SPORSMAL} mb-1`}>
        {label}
      </FieldLegend>
      {hjelp && <FieldDescription className={HJELP}>{hjelp}</FieldDescription>}
      <RadioGroup aria-labelledby={`${id}-sporsmal`} value={verdi ?? ""} onValueChange={(v) => velg(v as T)} className="gap-2">
        {valg.map((a) => (
          <FieldLabel key={a.verdi} htmlFor={`${id}-${a.verdi}`} className={VALGRAD}>
            <Field orientation="horizontal" className={VALGRAD_INNHOLD}>
              <RadioGroupItem value={a.verdi} id={`${id}-${a.verdi}`} disabled={a.deaktivert} aria-labelledby={`${id}-${a.verdi}-tittel`} aria-describedby={a.hjelp ? `${id}-${a.verdi}-hjelp` : undefined} className="mt-0.5" />
              <FieldContent>
                <FieldTitle id={`${id}-${a.verdi}-tittel`} className="text-[15px] font-medium">
                  {a.tekst}
                </FieldTitle>
                {a.hjelp && (
                  <FieldDescription id={`${id}-${a.verdi}-hjelp`} className={HJELP}>
                    {a.hjelp}
                  </FieldDescription>
                )}
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

// The same rows for a question where several answers can be true.
export function Flervalgsfelt<T extends string>({
  label,
  hjelp = "Velg alt som stemmer.",
  verdi,
  velg,
  valg,
}: {
  label: string;
  hjelp?: string;
  verdi: readonly T[];
  velg: (v: T[]) => void;
  valg: readonly Alternativ<T>[];
}) {
  const id = useId();
  return (
    <FieldSet className="m-0 gap-2 border-0 p-0">
      <FieldLegend id={`${id}-sporsmal`} variant="label" className={`${SPORSMAL} mb-1`}>
        {label}
      </FieldLegend>
      <FieldDescription className={HJELP}>{hjelp}</FieldDescription>
      <div role="group" aria-labelledby={`${id}-sporsmal`} className="flex flex-col gap-2">
        {valg.map((a) => (
          <FieldLabel key={a.verdi} htmlFor={`${id}-${a.verdi}`} className={VALGRAD}>
            <Field orientation="horizontal" className={VALGRAD_INNHOLD}>
              <Checkbox
                id={`${id}-${a.verdi}`}
                checked={verdi.includes(a.verdi)}
                onCheckedChange={(c) => velg(c === true ? [...verdi.filter((x) => x !== a.verdi), a.verdi] : verdi.filter((x) => x !== a.verdi))}
                aria-describedby={a.hjelp ? `${id}-${a.verdi}-hjelp` : undefined}
                className="mt-0.5"
              />
              <FieldContent>
                <FieldTitle className="text-[15px] font-medium">{a.tekst}</FieldTitle>
                {a.hjelp && (
                  <FieldDescription id={`${id}-${a.verdi}-hjelp`} className={HJELP}>
                    {a.hjelp}
                  </FieldDescription>
                )}
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </div>
    </FieldSet>
  );
}

// A question with many answers, as a drop-down.
export function Nedtrekk<T extends string>({ label, verdi, velg, valg }: { label: string; verdi: T | "" | undefined; velg: (v: T) => void; valg: readonly Alternativ<T>[] }) {
  const id = useId();
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={verdi ?? ""} onValueChange={(v) => velg(v as T)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Velg" />
        </SelectTrigger>
        <SelectContent position="popper">
          {valg.map((a) => (
            <SelectItem key={a.verdi} value={a.verdi}>
              {a.tekst}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const KRAV_TEKST: Record<NonNullable<Krav["type"]>, { tittel: string; tekst: string }> = {
  prisavslag: { tittel: "Prisavslag", tekst: "Du beholder bilen og får tilbake en del av kjøpesummen, vanligvis det det koster å rette feilen." },
  heving: { tittel: "Heving", tekst: "Du leverer bilen tilbake og får kjøpesummen tilbake. Krever at feilen ikke er uvesentlig." },
};
const UTGIFT_TEKST: Record<Utgift["type"], string> = { verksted: "Verksted og feilsøking", tauing: "Tauing", leiebil: "Leiebil", annet: "Annet" };

type UtgiftUtkast = { type: Utgift["type"]; belop: string; beskrivelse: string };

// What the buyer claims. The choice between a price reduction and cancelling is only there once the
// dealer has refused or failed to repair; before that the claim is repair. Costs can always be claimed.
export function KravFelt({
  kanVelge,
  verdi,
  aktiv,
  lagre,
  avbryt,
}: Felles & { kanVelge: boolean; verdi: Krav | undefined }) {
  const [type, setType] = useState<Krav["type"]>(verdi?.type);
  const [utbedring, setUtbedring] = useState(verdi?.utbedringNok ? String(verdi.utbedringNok) : "");
  const [utgifter, setUtgifter] = useState<UtgiftUtkast[]>(() => (verdi?.utgifter ?? []).map((u) => ({ type: u.type, belop: String(u.belopNok), beskrivelse: u.beskrivelse ?? "" })));

  if (!aktiv) {
    if (!verdi) return null;
    const sum = verdi.utgifter.reduce((s, u) => s + u.belopNok, 0);
    const hoved = !kanVelge ? "Retting uten kostnad for deg" : verdi.type === "heving" ? "Heving av kjøpet" : verdi.type === "prisavslag" ? `Prisavslag${verdi.utbedringNok ? ` på ${kroner(verdi.utbedringNok)}` : ""}` : null;
    return <Sammendrag linjer={[hoved, sum > 0 ? `Erstatning for utgifter: ${kroner(sum)}` : null]} />;
  }

  const endreUtgift = (n: number, e: Partial<UtgiftUtkast>) => setUtgifter((u) => u.map((x, i) => (i === n ? { ...x, ...e } : x)));
  const klar = (!kanVelge || type !== undefined) && utgifter.every((u) => u.belop !== "" && (u.type !== "annet" || u.beskrivelse.trim().length >= 2));
  const send = () =>
    lagre({
      krav: {
        ...(kanVelge && type && { type }),
        ...(kanVelge && type === "prisavslag" && utbedring !== "" && { utbedringNok: Number(utbedring) }),
        utgifter: utgifter.map((u) => ({ type: u.type, belopNok: Number(u.belop), ...(u.type === "annet" && { beskrivelse: u.beskrivelse.trim() }) })),
      },
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      {kanVelge ? (
        <Valgfelt label="Hva krever du?" verdi={type} velg={setType} valg={KRAV_TYPER.map((k) => ({ verdi: k, tekst: KRAV_TEKST[k].tittel, hjelp: KRAV_TEKST[k].tekst }))} />
      ) : (
        <p className={HJELP}>Forhandleren har rett til å forsøke å rette feilen først. Brevet krever derfor at feilen rettes uten kostnad for deg.</p>
      )}
      {kanVelge && type === "prisavslag" && (
        <Tekstfelt
          label="Hva koster det å rette feilen? (valgfritt)"
          hjelp="Bruk beløpet fra verkstedets tilbud eller rapport. Uten beløp krever brevet et forholdsmessig prisavslag."
          inputMode="numeric"
          placeholder="f.eks. 38 000"
          value={gruppert(utbedring)}
          onChange={(e) => setUtbedring(bareSiffer(e.target.value))}
        />
      )}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>Utgifter du vil ha erstattet (valgfritt)</span>
        <p className={HJELP}>Utgifter du har hatt på grunn av feilen, og som du har kvittering for.</p>
        {utgifter.map((u, n) => (
          <div key={n} role="group" aria-label={`Utgift ${n + 1}`} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Select value={u.type} onValueChange={(v) => endreUtgift(n, { type: v as Utgift["type"] })}>
                <SelectTrigger aria-label="Type utgift" className="min-w-0 flex-[3] px-2.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {UTGIFT_TYPER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {UTGIFT_TEKST[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input aria-label="Beløp i kroner" inputMode="numeric" placeholder="kr" value={gruppert(u.belop)} onChange={(e) => endreUtgift(n, { belop: bareSiffer(e.target.value) })} className="min-w-0 flex-[2] px-2.5" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setUtgifter((x) => x.filter((_, i) => i !== n))}>
                Fjern
              </Button>
            </div>
            {u.type === "annet" && (
              <Input
                aria-label="Hva var utgiften?"
                placeholder="Hva var utgiften? F.eks. drivstoff til verkstedet"
                value={u.beskrivelse}
                onChange={(e) => endreUtgift(n, { beskrivelse: e.target.value.slice(0, UTGIFT_BESKRIVELSE_MAKS) })}
              />
            )}
          </div>
        ))}
        {utgifter.length < MAKS_UTGIFTER && (
          <Button type="button" variant="link" onClick={() => setUtgifter((u) => [...u, { type: "verksted", belop: "", beskrivelse: "" }])} className="self-start text-[14px] text-[#1f3a5f]">
            Legg til utgift
          </Button>
        )}
      </div>
    </Skjema>
  );
}

// The sender of the letter: the buyer's name and address, and how to reach and pay them.
export function AvsenderFelt({ verdi, aktiv, lagre, avbryt }: Felles & { verdi: Avsender | undefined }) {
  const [a, setA] = useState({
    navn: verdi?.navn ?? "",
    adresse: verdi?.adresse ?? "",
    postnummer: verdi?.postnummer ?? "",
    poststed: verdi?.poststed ?? "",
    telefon: verdi?.telefon ?? "",
    epost: verdi?.epost ?? "",
    kontonummer: verdi?.kontonummer ?? "",
  });
  const sett = (felt: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setA((x) => ({ ...x, [felt]: e.target.value }));
  if (!aktiv) {
    if (!verdi) return null;
    return (
      <Sammendrag
        linjer={[
          verdi.navn,
          `${verdi.adresse}, ${verdi.postnummer} ${verdi.poststed}`,
          verdi.telefon ? `Tlf. ${verdi.telefon}` : null,
          verdi.epost ? verdi.epost : null,
          verdi.kontonummer ? `Konto ${kontonummerGruppert(verdi.kontonummer)}` : null,
        ]}
      />
    );
  }
  const epostOk = a.epost.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.epost.trim());
  const kontoOk = a.kontonummer === "" || gyldigKontonummer(a.kontonummer);
  const klar =
    a.navn.trim().length >= 2 &&
    a.adresse.trim().length >= 2 &&
    /^\d{4}$/.test(a.postnummer) &&
    a.poststed.trim() !== "" &&
    (a.telefon.trim() === "" || /^\+?[\d ]{8,16}$/.test(a.telefon.trim())) &&
    epostOk &&
    kontoOk;
  const send = () =>
    lagre({
      avsender: {
        navn: a.navn,
        adresse: a.adresse,
        postnummer: a.postnummer,
        poststed: a.poststed,
        ...(a.telefon.trim() && { telefon: a.telefon }),
        ...(a.epost.trim() && { epost: a.epost.trim() }),
        ...(a.kontonummer && { kontonummer: a.kontonummer }),
      },
    });
  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <p className={HJELP}>Navnet og adressen din står øverst i brevet, slik at forhandleren kan svare deg.</p>
      <Tekstfelt label="Navn" autoComplete="name" maxLength={100} value={a.navn} onChange={sett("navn")} />
      <Tekstfelt label="Adresse" autoComplete="street-address" maxLength={100} value={a.adresse} onChange={sett("adresse")} />
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
        <Tekstfelt label="Postnummer" autoComplete="postal-code" inputMode="numeric" maxLength={4} value={a.postnummer} onChange={(e) => setA((x) => ({ ...x, postnummer: e.target.value.replace(/\D/g, "") }))} />
        <Tekstfelt label="Sted" autoComplete="address-level2" maxLength={50} value={a.poststed} onChange={sett("poststed")} />
      </div>
      <Tekstfelt label="Telefon (valgfritt)" autoComplete="tel" inputMode="tel" maxLength={16} value={a.telefon} onChange={sett("telefon")} />
      <Tekstfelt
        label="E-post (anbefalt)"
        hjelp="Står i brevet, så forhandleren kan svare deg skriftlig."
        type="email"
        autoComplete="email"
        maxLength={100}
        value={a.epost}
        onChange={sett("epost")}
        feil={epostOk ? null : "Skriv en hel e-postadresse."}
      />
      <Tekstfelt
        label="Kontonummer (anbefalt)"
        hjelp="Står i brevet når du krever penger tilbake, så forhandleren vet hvor beløpet skal betales."
        inputMode="numeric"
        placeholder="1234 56 78903"
        value={kontonummerGruppert(a.kontonummer)}
        onChange={(e) => setA((x) => ({ ...x, kontonummer: kontonummerSiffer(e.target.value).replace(/\D/g, "").slice(0, 11) }))}
        feil={kontoOk || a.kontonummer.length < 11 ? null : "Kontonummeret stemmer ikke. Sjekk sifrene."}
      />
    </Skjema>
  );
}

export const BESKRIVELSE = { min: BESKRIVELSE_MIN, maks: BESKRIVELSE_MAKS };

// A pasted text (the report, the ad, the dealer's answer): long, with its line breaks. Optional; the
// written letter quotes only from texts like these.
export function Kildefelt({ label, hjelp, verdi, sett }: { label: string; hjelp: string; verdi: string; sett: (v: string) => void }) {
  const id = useId();
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea id={id} aria-describedby={`${id}-hjelp`} value={verdi} onChange={(e) => sett(e.target.value.slice(0, KILDE_MAKS))} className="min-h-35" />
      <FieldDescription id={`${id}-hjelp`} className={HJELP}>
        {hjelp}
      </FieldDescription>
    </Field>
  );
}
