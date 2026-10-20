import { eksempelRader, fyll } from "./eksempelbrev";
import { Adresser, BlokkEl } from "./sak/[id]/papir";

// The example letter in the hero: the letter the buyer gets for a made-up case, simplified. Each of the
// six sections the points beside the sheet name is one paragraph: legible from the top, and grey lines
// for the rest at the bottom (the sections are in eksempelbrev.ts). A numbered marker in the margin ties
// a section to its point. The component has no script: the sheet is part of the page when it is built.

// Legible text, with the decision's address shown as the site's name.
const Tekst = ({ t }: { t: string }) =>
  t.split(/(https?:\/\/\S+)/).map((d, i) =>
    i % 2 ? (
      <a key={i} href={d} target="_blank" rel="noopener">{new URL(d).hostname}</a>
    ) : (
      d
    ),
  );

export function HeroBrev() {
  const rader = eksempelRader();
  return (
    <div className="hb">
      <span className="hb-stempel">Forenklet eksempel</span>
      <article className="letter hb-ark" aria-label="Eksempel på reklamasjonsbrev" style={{ whiteSpace: "pre-line" }}>
        {rader.map((r, i) => {
          if (r.rad === "adresser")
            return (
              <div key={i} className="hb-rad">
                {r.merke && <span className="hb-nr" aria-label={`Punkt ${r.merke}`}>{r.merke}</span>}
                <Adresser a={r.a} b={r.b} />
              </div>
            );
          // The attachments on one line, as the simplified example shows them.
          if (r.rad === "blokk" && r.blokk.t === "ol") return <p key={i}>{r.blokk.punkter.map((d) => d.map((x) => (typeof x === "string" ? x : x.ph)).join("")).join(" · ")}</p>;
          // The greeting and the name without the blank line the letter leaves for a handwritten signature.
          if (r.rad === "blokk" && r.blokk.t === "sign") return <BlokkEl key={i} b={{ ...r.blokk, linjer: r.blokk.linjer.filter((l) => l.some((x) => typeof x !== "string" || x.trim())) }} />;
          if (r.rad === "blokk") return <BlokkEl key={i} b={r.blokk} />;
          return (
            <div key={i} className="hb-rad">
              {r.visMerke && <span className="hb-nr" aria-label={`Punkt ${r.merke}`}>{r.merke}</span>}
              {r.overskrift && <p className="l-h">{r.overskrift}</p>}
              <p>
                <Tekst t={r.tekst} />
                {r.skjult.kort > 0 && (
                  <>
                    {" "}
                    <span className="hb-sladd" aria-hidden="true">{fyll(r.skjult.kort)}</span>
                  </>
                )}
                {r.skjult.bred > 0 && (
                  <span className="hb-sladd hb-sladd-bred" aria-hidden="true">{" "}{fyll(r.skjult.bred)}</span>
                )}
              </p>
            </div>
          );
        })}
      </article>
      <p className="hb-skjult">Eksempelbrevet er forenklet, og deler av det er sladdet. Du får hele brevet.</p>
    </div>
  );
}
