"use client";

// The letter writer (artifact «writer»): tabs Skjema · Vurdering · Vedtak · Brevet, the steps rail and the form.
// For a paid case: the page gives the stored form, and every change is saved back to the case.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Merke } from "@/app/deler/merke";
import { Frem, Hake, Tilbake } from "@/app/deler/ikoner";
import { idag } from "@/lib/app/dato";
import { GRATIS, NYTT_KJOP } from "@/lib/pris";
import { type Skjema, syncAreas } from "@/lib/app/skjema";
import { type Lagring, useAutolagring } from "./autolagring";
import { Bilen, Kjopet } from "@/app/sak/skjema/bilen";
import type { StegProps } from "@/app/sak/skjema/felt";
import { Krav } from "@/app/sak/skjema/krav";
import { Feilen, Omrader, SagtFra, SelgerSa, Verksted } from "@/app/sak/skjema/mangelen";
import { Brevvalg, Deg, Forhandleren } from "@/app/sak/skjema/partene";
import { ALLE, har } from "@/app/sak/skjema/steg";
import { Brevet } from "./brevet";
import { skriverResultat } from "@/lib/app/vurdering";
import { useVedtak, Vedtaksfane } from "./vedtaksfane";
import { useLignende, Vurderingsfane } from "./vurderingsfane";

type Fane = "form" | "case" | "prec" | "letter";
type Steg = (p: StegProps) => React.ReactNode;

// The component for each section (ALLE), with the car locked and the «som den er» switch in Kjøpet. All
// but Deg, Forhandleren and Feilen are blocks only, and get a panel with the heading in HODE.
const STEG: Record<string, Steg> = {
  deg: Deg,
  forhandleren: Forhandleren,
  bilen: (p) => <Bilen {...p} laast />,
  kjopet: (p) => <Kjopet {...p} medForbehold />,
  feilen: Feilen,
  omrader: Omrader,
  verksted: Verksted,
  selger_sa: SelgerSa,
  sagt_fra: SagtFra,
  kravet: Krav,
  brevet: Brevvalg,
};
const HODE: Record<string, { tittel: string; tekst?: string }> = {
  bilen: { tittel: "Bilen", tekst: `Brevet gjelder bilen ${GRATIS ? "du valgte" : "du betalte for"}. Et brev for en annen bil krever ${NYTT_KJOP}.` },
  kjopet: { tittel: "Kjøpet", tekst: "Hent opplysningene fra kjøpekontrakten. Overtakelsesdatoen er utgangspunktet for alle fristene." },
  omrader: { tittel: "Om feilen" },
  verksted: { tittel: "Er feilen undersøkt av et verksted?", tekst: "En verkstedrapport gjør saken mye sterkere. Alt du krysser av for, føres opp i brevet." },
  selger_sa: { tittel: "Sa selger noe om denne feilen før kjøpet?", tekst: "For eksempel i annonsen, kontrakten eller en melding." },
  sagt_fra: { tittel: "Sagt fra før" },
  kravet: { tittel: "Hva krever du?", tekst: "Forhandleren har normalt rett til å forsøke å rette feilen først. Prisavslag og heving blir aktuelt når retting ikke skjer, ikke lykkes eller ikke er mulig." },
  brevet: { tittel: "Brevet" },
};
const LAGRING: Record<Lagring, string> = { lagret: "Lagret", lagrer: "Lagrer …", feil: "Ikke lagret, prøver igjen" };

export function Skriver({ id, start }: { id: string; start: Skjema }) {
  const [raa, settRaa] = useState<Skjema>(start);
  const lagring = useAutolagring(id, raa);
  const [fane, settFane] = useState<Fane>("form");
  const [steg, settSteg] = useState(0);
  const [toast, settToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => settToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const s = syncAreas(raa);
  const sett = (patch: Partial<Skjema>) => settRaa((f) => ({ ...f, ...patch }));
  const r = skriverResultat(s, idag());
  const lignende = useLignende(s);
  const vedtak = useVedtak(s, sett, id, fane === "prec" || fane === "letter");

  const tilFane = (t: Fane) => {
    settFane(t);
    window.scrollTo({ top: 0 });
  };
  const tilSteg = (i: number) => {
    settFane("form");
    settSteg(Math.max(0, i));
    window.scrollTo({ top: 0 });
  };

  const Steget = STEG[ALLE[steg].id];
  const tilSeksjon = (id: string) => tilSteg(ALLE.findIndex((st) => st.id === id));
  const status = ALLE.map((st) => ({ f: st.felt.filter((k) => har(s, k)).length, t: st.felt.length }));
  const pst = Math.round((status.reduce((a, x) => a + x.f, 0) / status.reduce((a, x) => a + x.t, 0)) * 100);
  const FANER: [Fane, string][] = [["form", "Skjema"], ["case", "Vurdering"], ["prec", "Vedtak"], ["letter", "Brevet"]];

  return (
    <div className="shell" id="shell" data-wtab={fane} data-tier={r.tier}>
      <header className="wtop">
        <div className="wleft" style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, justifySelf: "start" }}>
          <Merke />
          <Link href="/min-side" className="wback" aria-label="← Min side" style={{ fontSize: 14, color: "#465150", textDecoration: "none", whiteSpace: "nowrap" }}>
            ←<span className="wback-t"> Min side</span>
          </Link>
        </div>
        <nav className="wtabs" role="tablist" aria-label="Brevet">
          {FANER.map(([id, navn], k) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={fane === id}
              tabIndex={fane === id ? 0 : -1}
              onClick={() => tilFane(id)}
              onKeyDown={(e) => {
                const n = e.key === "ArrowRight" ? (k + 1) % FANER.length : e.key === "ArrowLeft" ? (k + FANER.length - 1) % FANER.length : -1;
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
          <div className={`saved ${lagring}`} role="status">
            <i />
            <span>{LAGRING[lagring]}</span>
          </div>
        </div>
      </header>

      <aside className="rail">
        <nav className="steps" aria-label="Steg">
          {ALLE.map((st, i) => {
            const ferdig = status[i].f === status[i].t;
            return (
              <button key={st.id} type="button" className={`st${ferdig && i !== steg ? " done" : ""}`} aria-current={i === steg ? "step" : undefined} aria-label={`${st.navn}, ${status[i].f} av ${status[i].t} felt utfylt`} onClick={() => tilSteg(i)}>
                <span className="st-i">{ferdig && i !== steg ? <Hake /> : i + 1}</span>
                <span className="st-t">
                  <span className="st-n">
                    <span className="st-l">{st.navn}</span>
                    <span className="st-s">{st.navn}</span>
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
            {HODE[ALLE[steg].id] ? (
              <section className="panel">
                <div className="head">
                  <h2>{HODE[ALLE[steg].id].tittel}</h2>
                  {HODE[ALLE[steg].id].tekst && <p>{HODE[ALLE[steg].id].tekst}</p>}
                </div>
                <Steget s={s} sett={sett} />
              </section>
            ) : (
              <Steget s={s} sett={sett} />
            )}
          </div>
        )}
        {fane === "case" && <Vurderingsfane s={s} r={r} lignende={lignende} brukes={s.prec_on ? s.prec_id : null} onSteg={tilSeksjon} onBrevet={() => tilFane("letter")} onSkjema={() => tilFane("form")} />}
        {fane === "prec" && <Vedtaksfane s={s} sett={sett} vedtak={vedtak} onBrevet={() => tilFane("letter")} />}
        {fane === "letter" && <Brevet id={id} s={s} sett={sett} vedtak={vedtak} onSteg={tilSeksjon} onVedtak={() => tilFane("prec")} onToast={settToast} />}
        {fane === "form" && (
          <div className="nav">
            <button type="button" className="btn gh" style={{ visibility: steg === 0 ? "hidden" : "visible" }} onClick={() => tilSteg(steg - 1)}>
              <Tilbake />
              <span>Tilbake</span>
            </button>
            <div className="nav-mid" aria-hidden="true">
              {ALLE.map((st, i) => (
                <span key={st.id} className={`pip${i === steg ? " on" : status[i].f === status[i].t ? " done" : ""}`} />
              ))}
            </div>
            <button type="button" className="btn pri" onClick={() => (steg === ALLE.length - 1 ? tilFane("letter") : tilSteg(steg + 1))}>
              <span>{steg === ALLE.length - 1 ? "Se brevet" : `Neste: ${ALLE[steg + 1].navn}`}</span>
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
