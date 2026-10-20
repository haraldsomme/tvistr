import { type Del, eksempelRader } from "./eksempelbrev";

// The example letter in the hero: a made-up letter, with parts of it censored (the text is in
// eksempelbrev.ts). A numbered marker in the margin ties a section to its point beside the sheet. The
// component has no script: the sheet is part of the page when it is built.

// Amounts and distances do not break inside the number («259 900»).
const tall = (t: string) => t.replace(/(\d) (?=\d{3}\b)/g, "$1\u00a0");

const Linje = ({ d }: { d: Del[] }) => (
  <>
    {d.map((x, i) =>
      x.sladd ? (
        <span key={i} className="hb-sladd" aria-hidden="true">
          {x.t}
        </span>
      ) : (
        tall(x.t)
      ),
    )}
  </>
);

const Adresse = ({ l, klasse }: { l: string[]; klasse?: string }) => (
  <p className={`l-addr${klasse ? ` ${klasse}` : ""}`}>
    {l.map((x, i) => (
      <span key={i}>
        {i > 0 && <br />}
        {x}
      </span>
    ))}
  </p>
);

const KLASSE = { dato: "l-date", emne: "l-subj", overskrift: "l-h", hilsen: "l-sign" } as const;

export function HeroBrev() {
  return (
    <div className="hb">
      <span className="hb-stempel">Forenklet eksempel</span>
      <article className="letter hb-ark" aria-label="Eksempel på reklamasjonsbrev" style={{ whiteSpace: "pre-line" }}>
        {eksempelRader().map((r, i) => {
          const nr = r.merke && (
            <span className="hb-nr" aria-label={`Punkt ${r.merke}`}>
              {r.merke}
            </span>
          );
          if (r.rad === "adresser")
            return (
              <div key={i} className="hb-rad">
                {nr}
                <div className="l-adr2">
                  <div className="l-adr2-in">
                    <Adresse l={r.a} />
                    <Adresse l={r.b} klasse="l-adr-b" />
                  </div>
                </div>
              </div>
            );
          return (
            <div key={i} className="hb-rad">
              {nr}
              <p className={r.rad === "avsnitt" ? undefined : KLASSE[r.rad]}>
                <Linje d={r.deler} />
              </p>
            </div>
          );
        })}
      </article>
      <p className="hb-skjult">Eksempelbrevet er forenklet, og deler av det er sladdet. Du får hele brevet.</p>
    </div>
  );
}
