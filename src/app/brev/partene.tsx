// Step 1, «Partene»: the buyer (sender) and the dealer (recipient). The dealer is looked up in Brreg's
// Enhetsregister (/api/firma) by name or organisation number.
import { useEffect, useRef, useState } from "react";
import { Hake } from "@/app/deler/ikoner";
import { sted } from "@/lib/brev/format";
import { FMT, orgValid } from "@/lib/app/format";
import { type Forslag, tittel } from "@/lib/brreg";
import { Felt, type StegProps } from "./felt";

function fyll(f: Forslag) {
  return {
    d_name: tittel(f.navn),
    d_org: FMT.org(f.orgnr),
    d_addr: f.adresse?.linjer.map(sted).join(", ") ?? "",
    d_zip: f.adresse?.postnummer ?? "",
    d_city: f.adresse ? sted(f.adresse.poststed) : "",
  };
}

async function sok(q: string): Promise<Forslag[]> {
  try {
    const r = await fetch(`/api/firma?q=${encodeURIComponent(q)}`);
    return ((await r.json()) as { forslag?: Forslag[] }).forslag ?? [];
  } catch {
    return [];
  }
}

export function Partene({ s, sett }: StegProps) {
  const [treff, settTreff] = useState<Forslag[]>([]);
  const [aktiv, settAktiv] = useState(-1);
  const [fylt, settFylt] = useState(false);
  const sekvens = useRef(0);
  const tid = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(tid.current), []);

  const velg = (f: Forslag) => {
    sett(fyll(f));
    settTreff([]);
    settFylt(true);
  };

  function skrivNavn(v: string) {
    sett({ d_name: v });
    settFylt(false);
    clearTimeout(tid.current);
    const n = ++sekvens.current;
    if (v.trim().length < 3) return settTreff([]);
    tid.current = setTimeout(async () => {
      const r = await sok(v);
      if (n === sekvens.current) {
        settTreff(r.slice(0, 6));
        settAktiv(-1);
      }
    }, 250);
  }

  async function skrivOrg(v: string) {
    const o = FMT.org(v);
    sett({ d_org: o });
    if (orgValid(o) !== true || s.d_addr) return;
    const [f] = await sok(o.replace(/\s/g, ""));
    if (f) velg(f);
  }

  const ov = orgValid(s.d_org);
  const n = s.d_org.replace(/\D/g, "").length;
  return (
    <section className="panel">
      <div className="head">
        <h2>Partene</h2>
        <p>Du er avsender, og brevet går til forhandleren du kjøpte bilen av. Hopp gjerne mellom stegene, ingenting må fylles ut før du går videre.</p>
      </div>
      <div className="block">
        <div className="bt">
          <h3>Deg</h3>
          <span>Avsender</span>
        </div>
        <div className="grid">
          <Felt s={s} sett={sett} k="b_name" label="Fullt navn" autoComplete="name" placeholder="Kari Nordmann" />
          <Felt s={s} sett={sett} k="b_addr" label="Adresse" autoComplete="street-address" placeholder="Storgata 12" />
          <Felt s={s} sett={sett} k="b_zip" label="Postnr." klasse="c2 m2" fmt="zip" inputMode="numeric" autoComplete="postal-code" placeholder="0155" mono />
          <Felt s={s} sett={sett} k="b_city" label="Poststed" klasse="c4 m4" autoComplete="address-level2" placeholder="Oslo" />
          <Felt s={s} sett={sett} k="b_phone" label="Telefon" klasse="c3" fmt="phone" inputMode="tel" autoComplete="tel-national" placeholder="912 34 567" prefiks="+47" />
          <Felt s={s} sett={sett} k="b_email" label="E-post" klasse="c3" type="email" autoComplete="email" placeholder="kari@eksempel.no" />
        </div>
      </div>
      <div className="block">
        <div className="bt">
          <h3>Forhandleren</h3>
          <span>Mottaker, også når feilen kommer fra fabrikken</span>
        </div>
        <div className="grid">
          <div className="f c4 ac-wrap">
            <label className="lb" htmlFor="f_d_name">
              Firmanavn
            </label>
            <input
              className="in"
              id="f_d_name"
              value={s.d_name}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={treff.length > 0}
              aria-controls="dealerAc"
              placeholder="Søk etter forhandleren"
              onChange={(e) => skrivNavn(e.target.value)}
              onBlur={() => setTimeout(() => settTreff([]), 120)}
              onKeyDown={(e) => {
                if (!treff.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  settAktiv((a) => Math.min(treff.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  settAktiv((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && aktiv >= 0) {
                  e.preventDefault();
                  velg(treff[aktiv]);
                } else if (e.key === "Escape") settTreff([]);
              }}
            />
            {treff.length > 0 && (
              <div className="ac" id="dealerAc" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                {treff.map((f, i) => (
                  <button key={f.orgnr} type="button" role="option" aria-selected={i === aktiv} className={`ac-o${i === aktiv ? " on" : ""}`} onClick={() => velg(f)}>
                    <b>{tittel(f.navn)}</b>
                    <span>
                      Org.nr. {FMT.org(f.orgnr)}
                      {f.adresse && ` · ${sted(f.adresse.poststed)}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="f c2">
            <label className="lb" htmlFor="f_d_org">
              Org.nr. <em>{ov === null ? (n ? `${n}/9` : "9 siffer") : ov ? <span className="tag good">Gyldig</span> : <span className="tag bad">Ugyldig</span>}</em>
            </label>
            <input className="in mono" id="f_d_org" inputMode="numeric" placeholder="923 456 783" value={s.d_org} onChange={(e) => skrivOrg(e.target.value)} />
          </div>
          <div className="c6 hint" id="dealerHint" style={{ marginTop: -10 }}>
            {fylt ? (
              <>
                <Hake s={13} /> Adresse og org.nr. er fylt inn. Sjekk at det stemmer med kontrakten.
              </>
            ) : (
              "Søk på navnet eller skriv org.nr., så fyller vi inn adressen."
            )}
          </div>
          <Felt s={s} sett={sett} k="d_contact" label={<>Kontaktperson <em>valgfritt</em></>} placeholder="Selgeren du handlet med" />
          <Felt s={s} sett={sett} k="d_addr" label="Adresse" placeholder="Industriveien 4" />
          <Felt s={s} sett={sett} k="d_zip" label="Postnr." klasse="c2 m2" fmt="zip" inputMode="numeric" placeholder="1337" mono />
          <Felt s={s} sett={sett} k="d_city" label="Poststed" klasse="c4 m4" placeholder="Sandvika" />
          <Felt s={s} sett={sett} k="d_email" label={<>E-post <em>valgfritt</em></>} type="email" placeholder="kundeservice@forhandler.no" hint="Send reklamasjonen skriftlig, så har du dokumentasjon på datoen." />
        </div>
      </div>
    </section>
  );
}
