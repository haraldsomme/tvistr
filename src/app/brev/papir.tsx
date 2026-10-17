// The letter on paper (artifact toHTML), from the same blocks as the copied text.
import type { Blokk, Del } from "@/lib/app/brev";

function Deler({ d }: { d: Del[] }) {
  return (
    <>
      {d.map((x, i) => (typeof x === "string" ? x : <span key={i} className="ph">{x.ph}</span>))}
    </>
  );
}

const Linjer = ({ l }: { l: Del[][] }) => (
  <>
    {l.map((d, i) => (
      <span key={i}>
        {i > 0 && <br />}
        <Deler d={d} />
      </span>
    ))}
  </>
);

export function Papir({ blokker, id }: { blokker: Blokk[]; id?: string }) {
  return (
    <article className="letter" id={id} aria-label="Reklamasjonsbrev" style={{ whiteSpace: "pre-line" }}>
      {blokker.map((b, i) => {
        switch (b.t) {
          case "addr":
            return <p key={i} className="l-addr"><Linjer l={b.linjer} /></p>;
          case "sign":
            return <p key={i} className="l-sign"><Linjer l={b.linjer} /></p>;
          case "date":
            return <p key={i} className="l-date"><Deler d={b.tekst} /></p>;
          case "subj":
            return <p key={i} className="l-subj"><Deler d={b.tekst} /></p>;
          case "h":
            return <p key={i} className="l-h"><Deler d={b.tekst} /></p>;
          case "p":
            return <p key={i}><Deler d={b.tekst} /></p>;
          case "ul":
            return <ul key={i} className="l-ul">{b.punkter.map((d, j) => <li key={j}><Deler d={d} /></li>)}</ul>;
          case "ol":
            return <ol key={i}>{b.punkter.map((d, j) => <li key={j}><Deler d={d} /></li>)}</ol>;
          case "prec":
            return <div key={i} className="l-prec">{b.avsnitt.map((d, j) => <p key={j}><Deler d={d} /></p>)}</div>;
          case "exp":
            return (
              <ul key={i} className="l-exp">
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
      })}
    </article>
  );
}
