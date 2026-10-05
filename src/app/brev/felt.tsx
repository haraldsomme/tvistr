"use client";

import { createContext, useContext, useId, useState, type FormEvent, type ReactNode } from "react";
import {
  BESKRIVELSE_MAKS,
  BESKRIVELSE_MIN,
  KRAV_TYPER,
  MAKS_UTGIFTER,
  UTGIFT_BESKRIVELSE_MAKS,
  UTGIFT_TYPER,
  type Avsender,
  type Krav,
  type Lagring,
  type Utgift,
} from "@/lib/brev/utfylling";

// The primitives the steps on the letter page share: form chrome, inputs, and formatting. The steps
// themselves live in `./steg/`; `KravFelt` and `AvsenderFelt` stay here because neither is folded into
// another step.

export type Felles = { aktiv: boolean; lagre: (lagring: Lagring) => Promise<boolean>; avbryt?: () => void };

export const LABEL = "text-[13px] font-semibold";
export const INPUT = "w-full rounded-[6px] border border-[#bfbab0] bg-white px-3.5 py-3 text-[16px] placeholder:text-[#8a94a3]";
export const HJELP = "m-0 text-[13px] leading-[1.5] text-[#5b6472]";

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

export const VEIVISER_LENKE = "px-2.5 py-[11px] text-[14px] font-medium text-[#5b6472]";

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
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!klar || lagrer} className="rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef] disabled:bg-[#dcd8cf] disabled:text-[#8a94a3]">
          {lagrer ? "Lagrer …" : veiviser && knapp === "Lagre" ? veiviser.nesteTekst : knapp}
        </button>
        {veiviser && (
          <>
            <button type="button" disabled={lagrer} onClick={veiviser.tilbake} className={VEIVISER_LENKE}>
              Tilbake
            </button>
            {veiviser.hoppOver && (
              <button type="button" disabled={lagrer} onClick={veiviser.hoppOver} className={`${VEIVISER_LENKE} underline underline-offset-2`}>
                Hopp over
              </button>
            )}
          </>
        )}
        {!veiviser && avbryt && (
          <button type="button" onClick={avbryt} className="px-2.5 py-[11px] text-[14px] font-medium text-[#5b6472]">
            Avbryt
          </button>
        )}
      </div>
    </form>
  );
}

export function Tekstfelt({ label, hjelp, ...input }: { label: string; hjelp?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} aria-describedby={hjelp ? `${id}-hjelp` : undefined} className={INPUT} {...input} />
      {hjelp && (
        <p id={`${id}-hjelp`} className={HJELP}>
          {hjelp}
        </p>
      )}
    </div>
  );
}

export function Nedtrekk({ label, children, ...select }: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} className={INPUT} {...select}>
        {children}
      </select>
    </div>
  );
}

export const KNAPP = "rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef] disabled:bg-[#dcd8cf] disabled:text-[#8a94a3]";
export const KNAPP_LYS = "rounded-[6px] border border-[#bfbab0] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#17263d] disabled:text-[#8a94a3]";
export const TEKSTOMRADE = `${INPUT} min-h-[112px] resize-y text-[15px] leading-[1.55]`;

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
  const id = useId();
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
        <div role="radiogroup" aria-labelledby={`${id}-krav`} className="flex flex-col gap-2">
          <span id={`${id}-krav`} className={LABEL}>
            Hva krever du?
          </span>
          {KRAV_TYPER.map((k) => (
            <label key={k} className={`flex cursor-pointer gap-3 rounded-lg border bg-white px-3.5 py-3 ${type === k ? "border-2 border-[#17263d]" : "border-[#bfbab0]"}`}>
              <input type="radio" name={`${id}-krav`} checked={type === k} onChange={() => setType(k)} className="mt-1 accent-[#17263d]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{KRAV_TEKST[k].tittel}</span>
                <span className={HJELP}>{KRAV_TEKST[k].tekst}</span>
              </span>
            </label>
          ))}
        </div>
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
              <select aria-label="Type utgift" value={u.type} onChange={(e) => endreUtgift(n, { type: e.target.value as Utgift["type"] })} className={`${INPUT} min-w-0 flex-[3] px-2.5`}>
                {UTGIFT_TYPER.map((t) => (
                  <option key={t} value={t}>
                    {UTGIFT_TEKST[t]}
                  </option>
                ))}
              </select>
              <input aria-label="Beløp i kroner" inputMode="numeric" placeholder="kr" value={gruppert(u.belop)} onChange={(e) => endreUtgift(n, { belop: bareSiffer(e.target.value) })} className={`${INPUT} min-w-0 flex-[2] px-2.5`} />
              <button type="button" onClick={() => setUtgifter((x) => x.filter((_, i) => i !== n))} className="text-[13px] font-medium text-[#5b6472]">
                Fjern
              </button>
            </div>
            {u.type === "annet" && (
              <input
                aria-label="Hva var utgiften?"
                placeholder="Hva var utgiften? F.eks. drivstoff til verkstedet"
                value={u.beskrivelse}
                onChange={(e) => endreUtgift(n, { beskrivelse: e.target.value.slice(0, UTGIFT_BESKRIVELSE_MAKS) })}
                className={INPUT}
              />
            )}
          </div>
        ))}
        {utgifter.length < MAKS_UTGIFTER && (
          <button type="button" onClick={() => setUtgifter((u) => [...u, { type: "verksted", belop: "", beskrivelse: "" }])} className="self-start text-[14px] font-medium text-[#1f3a5f] underline underline-offset-2">
            Legg til utgift
          </button>
        )}
      </div>
    </Skjema>
  );
}

// The sender of the letter: the buyer's name and address.
export function AvsenderFelt({ verdi, aktiv, lagre, avbryt }: Felles & { verdi: Avsender | undefined }) {
  const [a, setA] = useState({ navn: verdi?.navn ?? "", adresse: verdi?.adresse ?? "", postnummer: verdi?.postnummer ?? "", poststed: verdi?.poststed ?? "", telefon: verdi?.telefon ?? "" });
  const sett = (felt: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setA((x) => ({ ...x, [felt]: e.target.value }));
  if (!aktiv) {
    if (!verdi) return null;
    return <Sammendrag linjer={[verdi.navn, `${verdi.adresse}, ${verdi.postnummer} ${verdi.poststed}`, verdi.telefon ? `Tlf. ${verdi.telefon}` : null]} />;
  }
  const klar = a.navn.trim().length >= 2 && a.adresse.trim().length >= 2 && /^\d{4}$/.test(a.postnummer) && a.poststed.trim() !== "" && (a.telefon.trim() === "" || /^\+?[\d ]{8,16}$/.test(a.telefon.trim()));
  return (
    <Skjema klar={klar} send={() => lagre({ avsender: { navn: a.navn, adresse: a.adresse, postnummer: a.postnummer, poststed: a.poststed, ...(a.telefon.trim() && { telefon: a.telefon }) } })} avbryt={avbryt}>
      <p className={HJELP}>Navnet og adressen din står øverst i brevet, slik at forhandleren kan svare deg.</p>
      <Tekstfelt label="Navn" autoComplete="name" maxLength={100} value={a.navn} onChange={sett("navn")} />
      <Tekstfelt label="Adresse" autoComplete="street-address" maxLength={100} value={a.adresse} onChange={sett("adresse")} />
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
        <Tekstfelt label="Postnummer" autoComplete="postal-code" inputMode="numeric" maxLength={4} value={a.postnummer} onChange={(e) => setA((x) => ({ ...x, postnummer: e.target.value.replace(/\D/g, "") }))} />
        <Tekstfelt label="Sted" autoComplete="address-level2" maxLength={50} value={a.poststed} onChange={sett("poststed")} />
      </div>
      <Tekstfelt label="Telefon (valgfritt)" autoComplete="tel" inputMode="tel" maxLength={16} value={a.telefon} onChange={sett("telefon")} />
    </Skjema>
  );
}

export const BESKRIVELSE = { min: BESKRIVELSE_MIN, maks: BESKRIVELSE_MAKS };
