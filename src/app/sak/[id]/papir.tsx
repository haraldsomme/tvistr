// The letter's blocks on paper (artifact toHTML), from the same blocks as the copied text: Brevrute and the
// landing page place them on their own sheet.
import { createContext, useContext } from "react";
import type { Blokk, Del } from "@/lib/app/brevtyper";

// The fields whose text just changed, marked `fl-ny` (Brevrute); none elsewhere.
export const NyeFelt = createContext<ReadonlySet<string>>(new Set());

// A placeholder, one of the buyer's answers (with its field, for marking and clicking), or a bar for
// hidden text of about its length.
function DelEl({ x }: { x: Del }) {
  const nye = useContext(NyeFelt);
  if (typeof x === "string") return x;
  if ("ph" in x) return <span className="ph">{x.ph}</span>;
  if ("felt" in x) return <span className={nye.has(x.felt) ? "fe fl-ny" : "fe"} data-felt={x.felt}>{x.tekst}</span>;
  return <span className="sl" style={{ width: `${Math.min(x.skjult, 60)}ch` }} aria-label="Skjult tekst" />;
}

export function Deler({ d }: { d: Del[] }) {
  return (
    <>
      {d.map((x, i) => <DelEl key={i} x={x} />)}
    </>
  );
}

export const Linjer = ({ l }: { l: Del[][] }) => (
  <>
    {l.map((d, i) => (
      <span key={i}>
        {i > 0 && <br />}
        <Deler d={d} />
      </span>
    ))}
  </>
);

// One block of the letter. The landing page draws the example letter from the same blocks.
export function BlokkEl({ b }: { b: Blokk }) {
  switch (b.t) {
    case "addr":
      return <p className="l-addr"><Linjer l={b.linjer} /></p>;
    case "sign":
      return <p className="l-sign"><Linjer l={b.linjer} /></p>;
    case "date":
      return <p className="l-date"><Deler d={b.tekst} /></p>;
    case "subj":
      return <p className="l-subj"><Deler d={b.tekst} /></p>;
    case "h":
      return <p className="l-h"><Deler d={b.tekst} /></p>;
    case "p":
      return <p><Deler d={b.tekst} /></p>;
    case "ul":
      return <ul className="l-ul">{b.punkter.map((d, j) => <li key={j}><Deler d={d} /></li>)}</ul>;
    case "ol":
      return <ol>{b.punkter.map((d, j) => <li key={j}><Deler d={d} /></li>)}</ol>;
    case "prec":
      return <div className="l-prec">{b.avsnitt.map((d, j) => <p key={j}><Deler d={d} /></p>)}</div>;
    case "exp":
      return (
        <ul className="l-exp">
          {b.rader.map(([a, c], j) => (
            <li key={j}>
              <span><Deler d={a} /></span>
              <span>{c}</span>
            </li>
          ))}
          <li className="tot">
            <span>Sum</span>
            <span>{b.sum}</span>
          </li>
        </ul>
      );
  }
}

// The sender on the left and the receiver on the right, on one line (a stacked pair when narrow).
export function Adresser({ a, b }: { a: Blokk; b: Blokk }) {
  if (a.t !== "addr" || b.t !== "addr") return null;
  return (
    <div className="l-adr2">
      <div className="l-adr2-in">
        <p className="l-addr"><Linjer l={a.linjer} /></p>
        <p className="l-addr l-adr-b"><Linjer l={b.linjer} /></p>
      </div>
    </div>
  );
}
