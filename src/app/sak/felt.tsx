import { useId } from "react";

// Only imported by the form (a client component), so these run on the client without a directive.
// Form controls in the landing page's look (src/app/page.tsx): native inputs, so keyboard, screen
// readers and mobile pickers work without a component library.

const RAMME = "rounded-[6px] border border-[#cfcac0] bg-white text-[16px] text-[#17263d] outline-none focus:border-[#1f3a5f] focus:ring-2 focus:ring-[#1f3a5f]/20";

export function Sporsmal({
  tittel,
  hjelp,
  feil,
  children,
  id,
}: {
  tittel: string;
  hjelp?: React.ReactNode;
  feil?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0" aria-invalid={feil ? true : undefined} id={id}>
      <legend className="mb-1 p-0 text-[17px] font-semibold leading-[1.35] text-[#17263d]">{tittel}</legend>
      {hjelp && <p className="m-0 -mt-1 text-[14px] leading-[1.5] text-[#5b6472]">{hjelp}</p>}
      {children}
      {feil && (
        <p role="alert" className="m-0 text-[14px] font-medium text-[#a3372b]">
          {feil}
        </p>
      )}
    </fieldset>
  );
}

export type Alternativ = { verdi: string; tekst: string; forklaring?: string };

export function Valg({ navn, verdi, alternativer, onChange }: { navn: string; verdi: string; alternativer: Alternativ[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {alternativer.map((a) => (
        <label
          key={a.verdi}
          className={`flex cursor-pointer items-start gap-3 rounded-[6px] border px-4 py-3 text-[16px] leading-[1.4] ${
            verdi === a.verdi ? "border-[#1f3a5f] bg-[#eef1f5]" : "border-[#cfcac0] bg-white hover:border-[#9aa3b0]"
          }`}
        >
          <input
            type="radio"
            name={navn}
            value={a.verdi}
            checked={verdi === a.verdi}
            onChange={() => onChange(a.verdi)}
            className="mt-[3px] size-[18px] shrink-0 accent-[#1f3a5f]"
          />
          <span className="flex flex-col gap-0.5">
            <span>{a.tekst}</span>
            {a.forklaring && <span className="text-[14px] text-[#5b6472]">{a.forklaring}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Flervalg({ verdier, alternativer, onChange }: { verdier: string[]; alternativer: Alternativ[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {alternativer.map((a) => {
        const valgt = verdier.includes(a.verdi);
        return (
          <label
            key={a.verdi}
            className={`flex cursor-pointer items-center gap-3 rounded-[6px] border px-4 py-3 text-[16px] ${
              valgt ? "border-[#1f3a5f] bg-[#eef1f5]" : "border-[#cfcac0] bg-white hover:border-[#9aa3b0]"
            }`}
          >
            <input
              type="checkbox"
              checked={valgt}
              onChange={() => onChange(valgt ? verdier.filter((v) => v !== a.verdi) : [...verdier, a.verdi])}
              className="size-[18px] shrink-0 accent-[#1f3a5f]"
            />
            {a.tekst}
          </label>
        );
      })}
    </div>
  );
}

export function Tekst({
  verdi,
  onChange,
  etikett,
  type = "text",
  inputMode,
  bredde = "w-full",
  etter,
  ...rest
}: {
  verdi: string;
  onChange: (v: string) => void;
  etikett: string;
  type?: "text" | "email" | "date";
  inputMode?: "numeric" | "text" | "email";
  bredde?: string;
  etter?: string;
  autoComplete?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {etikett}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={verdi}
          onChange={(e) => onChange(e.target.value)}
          aria-label={etikett}
          className={`${RAMME} ${bredde} px-3.5 py-3`}
          {...rest}
        />
        {etter && <span className="text-[16px] text-[#3d4757]">{etter}</span>}
      </div>
    </div>
  );
}

// A free-text answer that completes a sentence, so it fits the letter's templates as typed.
export function Stubb({ stubb, verdi, onChange, maks, rader = 3 }: { stubb: string; verdi: string; onChange: (v: string) => void; maks: number; rader?: number }) {
  const id = useId();
  return (
    <div className={`${RAMME} flex flex-col gap-1 px-3.5 py-3 focus-within:border-[#1f3a5f] focus-within:ring-2 focus-within:ring-[#1f3a5f]/20`}>
      <label htmlFor={id} className="font-brev text-[16px] italic text-[#5b6472]">
        «{stubb} …»
      </label>
      <textarea
        id={id}
        rows={rader}
        maxLength={maks}
        value={verdi}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y border-0 bg-transparent p-0 text-[16px] leading-[1.5] text-[#17263d] outline-none"
      />
    </div>
  );
}

export function Fritekst({ verdi, onChange, etikett, maks, rader = 3 }: { verdi: string; onChange: (v: string) => void; etikett: string; maks: number; rader?: number }) {
  return (
    <textarea
      aria-label={etikett}
      rows={rader}
      maxLength={maks}
      value={verdi}
      onChange={(e) => onChange(e.target.value)}
      className={`${RAMME} w-full resize-y px-3.5 py-3 leading-[1.5]`}
    />
  );
}

export function Avkrysning({ verdi, onChange, children, feil }: { verdi: boolean; onChange: (v: boolean) => void; children: React.ReactNode; feil?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer items-start gap-3 text-[16px] leading-[1.45] text-[#17263d]">
        <input type="checkbox" checked={verdi} onChange={(e) => onChange(e.target.checked)} className="mt-[3px] size-[18px] shrink-0 accent-[#1f3a5f]" />
        <span>{children}</span>
      </label>
      {feil && (
        <p role="alert" className="m-0 pl-[30px] text-[14px] font-medium text-[#a3372b]">
          {feil}
        </p>
      )}
    </div>
  );
}

export function Merknad({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-[6px] border-l-[3px] border-[#1f3a5f] bg-[#eef1f5] px-4 py-3 text-[15px] leading-[1.5] text-[#3d4757]">{children}</p>;
}
