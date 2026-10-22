// The sections filled in after payment: the buyer (sender), the dealer (recipient) and the attachments,
// as blocks for a page to place under its own heading. The dealer is looked up in Brreg's
// Enhetsregister (/api/firma) by name or organisation number; the names found are the input's datalist.
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

export function Deg({ s, sett }: StegProps) {
  return (
    <div className="block">
      <div className="grid">
        <Felt s={s} sett={sett} k="b_name" label="Fullt navn" autoComplete="name" placeholder="Kari Nordmann" />
        <Felt s={s} sett={sett} k="b_addr" label="Adresse" autoComplete="street-address" placeholder="Storgata 12" />
        <Felt s={s} sett={sett} k="b_zip" label="Postnr." klasse="c2 m2" fmt="zip" inputMode="numeric" autoComplete="postal-code" placeholder="0155" mono />
        <Felt s={s} sett={sett} k="b_city" label="Poststed" klasse="c4 m4" autoComplete="address-level2" placeholder="Oslo" />
        <Felt s={s} sett={sett} k="b_phone" label="Telefon" klasse="c3" fmt="phone" inputMode="tel" autoComplete="tel-national" placeholder="912 34 567" prefiks="+47" />
        <Felt s={s} sett={sett} k="b_email" label="E-post" klasse="c3" type="email" autoComplete="email" placeholder="kari@eksempel.no" />
      </div>
    </div>
  );
}

export function Forhandleren({ s, sett }: StegProps) {
  const [treff, settTreff] = useState<Forslag[]>([]);
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
    // A name picked from the list fills in the rest.
    const f = treff.find((t) => tittel(t.navn) === v);
    if (f) return velg(f);
    sett({ d_name: v });
    settFylt(false);
    clearTimeout(tid.current);
    const n = ++sekvens.current;
    if (v.trim().length < 3) return settTreff([]);
    tid.current = setTimeout(async () => {
      const r = await sok(v);
      if (n === sekvens.current) settTreff(r.slice(0, 6));
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
    <div className="block">
      <div className="grid">
        <div className="f c4">
          <label className="lb" htmlFor="f_d_name">
            Firmanavn
          </label>
          <input className="in" id="f_d_name" list="dealerAc" value={s.d_name} autoComplete="off" placeholder="Søk etter forhandleren" onChange={(e) => skrivNavn(e.target.value)} />
          <datalist id="dealerAc">
            {treff.map((f) => (
              <option key={f.orgnr} value={tittel(f.navn)} label={`Org.nr. ${FMT.org(f.orgnr)}${f.adresse ? ` · ${sted(f.adresse.poststed)}` : ""}`} />
            ))}
          </datalist>
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
        <Felt s={s} sett={sett} k="d_addr" label="Adresse" placeholder="Industriveien 4" />
        <Felt s={s} sett={sett} k="d_zip" label="Postnr." klasse="c2 m2" fmt="zip" inputMode="numeric" placeholder="1337" mono />
        <Felt s={s} sett={sett} k="d_city" label="Poststed" klasse="c4 m4" placeholder="Sandvika" />
      </div>
    </div>
  );
}
