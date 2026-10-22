// The writer's form controls, as the artifact draws them (.f/.lb/.in, .sw/.tg, .vl, .seg, .rv).
import type { ReactNode } from "react";
import { Hake } from "@/app/deler/ikoner";
import { FMT, type Format } from "@/lib/app/format";
import type { Skjema } from "@/lib/app/skjema";

export type Sett = (patch: Partial<Skjema>) => void;
export type StegProps = { s: Skjema; sett: Sett };
type Tekstfelt = { [K in keyof Skjema]: Skjema[K] extends string ? K : never }[keyof Skjema];
type Bryterfelt = { [K in keyof Skjema]: Skjema[K] extends boolean ? K : never }[keyof Skjema];

export function Felt(p: {
  s: Skjema;
  sett: Sett;
  k: Tekstfelt;
  label: ReactNode;
  klasse?: string;
  fmt?: Format;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  mono?: boolean;
  suffiks?: string;
  prefiks?: string;
  hint?: ReactNode;
  flerlinje?: number;
  disabled?: boolean;
}) {
  const id = `f_${p.k}`;
  const endre = (v: string) => p.sett({ [p.k]: p.fmt ? FMT[p.fmt](v) : v } as Partial<Skjema>);
  const felles = { id, value: p.s[p.k], placeholder: p.placeholder, className: `in${p.mono ? " mono" : ""}`, disabled: p.disabled };
  const input = p.flerlinje ? (
    <textarea {...felles} style={{ minHeight: p.flerlinje }} onChange={(e) => endre(e.target.value)} />
  ) : (
    <input {...felles} type={p.type ?? "text"} inputMode={p.inputMode} autoComplete={p.autoComplete} onChange={(e) => endre(e.target.value)} />
  );
  return (
    <div className={`f ${p.klasse ?? "c6"}`}>
      <label className="lb" htmlFor={id}>
        {p.label}
      </label>
      {p.suffiks || p.prefiks ? (
        <div className={`ad${p.prefiks ? " pre" : ""}`}>
          {input}
          <span className="sx">{p.suffiks ?? p.prefiks}</span>
        </div>
      ) : (
        input
      )}
      {p.hint && <span className="hint">{p.hint}</span>}
    </div>
  );
}

export function Bryter({ s, sett, k, tittel, tekst, stil }: { s: Skjema; sett: Sett; k: Bryterfelt; tittel: string; tekst: string; stil?: React.CSSProperties }) {
  return (
    <label className="sw" htmlFor={`f_${k}`} style={stil}>
      <div>
        <div className="sw-t">{tittel}</div>
        <div className="sw-d">{tekst}</div>
      </div>
      <input className="tg" type="checkbox" role="switch" id={`f_${k}`} checked={s[k]} onChange={(e) => sett({ [k]: e.target.checked } as Partial<Skjema>)} />
    </label>
  );
}

// Choices as rows with a box: several (checkbox) when `flere`, else one (radio), in the look of the
// defect list (src/app/deler/feilliste.tsx). `bredde` is the narrowest column; one column when wider.
export function Valgliste({ verdi, valg, onVelg, navn, flere, bredde = 240 }: { verdi: string | string[]; valg: readonly (readonly [string, string, string?])[]; onVelg: (v: string, pa: boolean) => void; navn: string; flere?: boolean; bredde?: number }) {
  return (
    <div className="vl" style={{ "--vl-min": `${bredde}px` } as React.CSSProperties}>
      {valg.map(([v, l, d]) => {
        const pa = Array.isArray(verdi) ? verdi.includes(v) : verdi === v;
        return (
          <label key={v} className="vl-r">
            <input type={flere ? "checkbox" : "radio"} name={navn} value={v} checked={pa} onChange={(e) => onVelg(v, e.target.checked)} />
            {flere ? (
              <span className="fl-box" aria-hidden="true">
                <Hake />
              </span>
            ) : (
              <span className="rad" aria-hidden="true" />
            )}
            <span className="vl-t">
              {l}
              {d && <small>{d}</small>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Choices as cards like the defect list (src/app/deler/feilliste.tsx): several (a box) when `flere`,
// else one (a circle), each with an optional icon and a line under its name.
export function Kortliste({ verdi, valg, onVelg, navn, flere, ikon }: { verdi: string | string[]; valg: readonly (readonly [string, string, string?])[]; onVelg: (v: string, pa: boolean) => void; navn: string; flere?: boolean; ikon?: (v: string) => ReactNode }) {
  return (
    <div className="fl" role={flere ? "group" : "radiogroup"} aria-label={navn}>
      {valg.map(([v, l, d]) => {
        const pa = Array.isArray(verdi) ? verdi.includes(v) : verdi === v;
        return (
          <div key={v} className={`fl-c${pa ? " on" : ""}`}>
            <button type="button" role={flere ? "checkbox" : "radio"} aria-checked={pa} className="fl-h" onClick={() => onVelg(v, flere ? !pa : true)}>
              {ikon && (
                <span className="ico" aria-hidden="true">
                  {ikon(v)}
                </span>
              )}
              <span className="fl-n">
                {l}
                {d && <small>{d}</small>}
              </span>
              {flere ? (
                <span className="fl-box" aria-hidden="true">
                  <Hake />
                </span>
              ) : (
                <span className="rad" aria-hidden="true" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Seg({ verdi, valg, onVelg, navn }: { verdi: string; valg: readonly (readonly [string, string])[]; onVelg: (v: string) => void; navn: string }) {
  return (
    <div className="seg">
      {valg.map(([v, l]) => (
        <label key={v}>
          <input type="radio" name={navn} value={v} checked={verdi === v} onChange={() => onVelg(v)} />
          <span>{l}</span>
        </label>
      ))}
    </div>
  );
}

// A part of the form shown only when `pa` (artifact .rv with data-show).
export function Vis({ pa, children, klasse }: { pa: boolean; children: ReactNode; klasse?: string }) {
  return (
    <div className={`rv${pa ? "" : " off"}${klasse ? ` ${klasse}` : ""}`} inert={!pa}>
      <div>{children}</div>
    </div>
  );
}
