"use client";

// The letter writer (artifact «writer»): tabs Skjema · Vurdering · Brevet, the steps rail and the form.
// Only for a buyer who has unlocked it; the answers stay in localStorage (tvistr-skjema).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Merke } from "@/app/deler/merke";
import { Frem, Hake, Tilbake } from "@/app/deler/ikoner";
import { idag } from "@/lib/app/dato";
import { useLagret } from "@/lib/app/lagring";
import { type Skjema, standard, syncAreas } from "@/lib/app/skjema";
import { Bilen } from "./bilen";
import { Brevet } from "./brevet";
import { Krav } from "./krav";
import { Mangelen } from "./mangelen";
import { Partene } from "./partene";
import { skriverResultat, useLignende, Vurderingsfane } from "./vurderingsfane";

type Fane = "form" | "case" | "letter";
type Nokkel = keyof Skjema | "f_any_desc";

const STEG: { navn: string; kort: string; felt: Nokkel[] }[] = [
  { navn: "Partene", kort: "Partene", felt: ["b_name", "b_addr", "b_zip", "b_city", "b_phone", "b_email", "d_name", "d_org", "d_addr", "d_zip", "d_city"] },
  { navn: "Bilen", kort: "Bilen", felt: ["c_make", "c_model", "c_year", "c_reg", "c_purchase", "c_delivery", "c_price", "c_km"] },
  { navn: "Mangelen", kort: "Feilen", felt: ["f_cats", "f_found", "f_any_desc", "f_impact", "ws"] },
  { navn: "Krav", kort: "Krav", felt: ["k_main", "k_days"] },
];
export const ETIKETT: Record<string, string> = {
  b_name: "Navn", b_addr: "Adresse", b_zip: "Postnr.", b_city: "Poststed", b_phone: "Telefon", b_email: "E-post",
  d_name: "Firmanavn", d_org: "Org.nr.", d_addr: "Adresse", d_zip: "Postnr.", d_city: "Poststed",
  c_make: "Merke", c_model: "Modell", c_year: "Årsmodell", c_reg: "Reg.nr.", c_purchase: "Kjøpsdato", c_delivery: "Overtakelsesdato", c_price: "Kjøpesum", c_km: "Km-stand",
  f_cats: "Deler", f_found: "Dato oppdaget", f_any_desc: "Beskrivelse av feilen", f_impact: "Hvordan feilen påvirker deg", ws: "Verkstedundersøkelse", k_main: "Hovedkrav", k_days: "Svarfrist",
};

export function har(s: Skjema, k: Nokkel): boolean {
  if (k === "f_any_desc") return !!s.f_desc.trim() || s.f_cats.some((c) => (s.f_catdesc[c] ?? "").trim());
  const v = s[k];
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== false && v !== null && v !== undefined;
}
// The steps with what is missing in each, for the checklist in Brevet.
export const mangler = (s: Skjema) => STEG.map((st, i) => ({ i, navn: st.navn, felt: st.felt.filter((k) => !har(s, k)) })).filter((x) => x.felt.length);

export function Skriver() {
  const router = useRouter();
  const [ordre, , ordreKlar] = useLagret("tvistr-ordre", () => "");
  const [raa, settRaa] = useLagret<Skjema>("tvistr-skjema", () => standard(idag()));
  const [fane, settFane] = useState<Fane>("form");
  const [steg, settSteg] = useState(0);
  const [toast, settToast] = useState<string | null>(null);

  useEffect(() => {
    if (ordreKlar && !ordre) router.replace("/sak");
  }, [ordreKlar, ordre, router]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => settToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const s = syncAreas(raa);
  const sett = (patch: Partial<Skjema>) => settRaa((f) => ({ ...f, ...patch }));
  const r = skriverResultat(s, idag());
  const lignende = useLignende(s);

  const tilFane = (t: Fane) => {
    settFane(t);
    window.scrollTo({ top: 0 });
  };
  const tilSteg = (i: number) => {
    settFane("form");
    settSteg(i);
    window.scrollTo({ top: 0 });
  };

  if (!ordreKlar || !ordre) return null;
  const status = STEG.map((st) => ({ f: st.felt.filter((k) => har(s, k)).length, t: st.felt.length }));
  const pst = Math.round((status.reduce((a, x) => a + x.f, 0) / status.reduce((a, x) => a + x.t, 0)) * 100);
  const FANER: [Fane, string][] = [["form", "Skjema"], ["case", "Vurdering"], ["letter", "Brevet"]];

  return (
    <div className="shell" id="shell" data-wtab={fane} data-tier={r.tier}>
      <header className="wtop">
        <Merke undertekst="Klage på mangel ved bilkjøp" />
        <nav className="wtabs" role="tablist" aria-label="Brevskriveren">
          {FANER.map(([id, navn], k) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={fane === id}
              tabIndex={fane === id ? 0 : -1}
              onClick={() => tilFane(id)}
              onKeyDown={(e) => {
                const n = e.key === "ArrowRight" ? (k + 1) % 3 : e.key === "ArrowLeft" ? (k + 2) % 3 : -1;
                if (n < 0) return;
                e.preventDefault();
                tilFane(FANER[n][0]);
                (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
              }}
            >
              {id === "case" && <i className="tdot" aria-hidden="true" />}
              {navn}
            </button>
          ))}
        </nav>
        <div className="wtools">
          <div className="saved">
            <i />
            <span>Utkast lagres i nettleseren</span>
          </div>
        </div>
      </header>

      <aside className="rail">
        <nav className="steps" aria-label="Steg">
          {STEG.map((st, i) => {
            const ferdig = status[i].f === status[i].t;
            return (
              <button key={st.navn} type="button" className={`st${ferdig && i !== steg ? " done" : ""}`} aria-current={i === steg ? "step" : undefined} aria-label={`${st.navn}, ${status[i].f} av ${status[i].t} felt utfylt`} onClick={() => tilSteg(i)}>
                <span className="st-i">{ferdig && i !== steg ? <Hake /> : i + 1}</span>
                <span className="st-t">
                  <span className="st-n">
                    <span className="st-l">{st.navn}</span>
                    <span className="st-s">{st.kort}</span>
                  </span>
                  <span className="st-m">{ferdig ? "Fullført" : `${status[i].f} av ${status[i].t} felt`}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="overall">
          <div className="overall-top">
            <span>Utfylt</span>
            <b>{pst} %</b>
          </div>
          <div className="meter">
            <i style={{ width: `${pst}%` }} />
          </div>
          <button type="button" className="ov-case" onClick={() => tilFane("case")}>
            <span>Saksstyrke</span>
            <span className="tchip">
              <i className="tdot" aria-hidden="true" />
              <span>{r.badge}</span>
            </span>
          </button>
        </div>
      </aside>

      <form className="main" noValidate autoComplete="on" onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && e.preventDefault()}>
        {fane === "form" && (
          <div key={steg}>
            {steg === 0 && <Partene s={s} sett={sett} />}
            {steg === 1 && <Bilen s={s} sett={sett} />}
            {steg === 2 && <Mangelen s={s} sett={sett} />}
            {steg === 3 && <Krav s={s} sett={sett} />}
          </div>
        )}
        {fane === "case" && <Vurderingsfane s={s} r={r} lignende={lignende} brukes={s.prec_on ? s.prec_id : null} onSteg={tilSteg} onBrevet={() => tilFane("letter")} onSkjema={() => tilFane("form")} />}
        {fane === "letter" && <Brevet s={s} sett={sett} ordre={ordre} onSteg={tilSteg} onToast={settToast} />}
        {fane === "form" && (
          <div className="nav">
            <button type="button" className="btn gh" style={{ visibility: steg === 0 ? "hidden" : "visible" }} onClick={() => tilSteg(steg - 1)}>
              <Tilbake />
              <span>Tilbake</span>
            </button>
            <div className="nav-mid" aria-hidden="true">
              {STEG.map((st, i) => (
                <span key={st.navn} className={`pip${i === steg ? " on" : status[i].f === status[i].t ? " done" : ""}`} />
              ))}
            </div>
            <button type="button" className="btn pri" onClick={() => (steg === STEG.length - 1 ? tilFane("case") : tilSteg(steg + 1))}>
              <span>{steg === STEG.length - 1 ? "Se vurderingen" : `Neste: ${STEG[steg + 1].navn}`}</span>
              <Frem />
            </button>
          </div>
        )}
      </form>
      <div className={`toast${toast ? " on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
