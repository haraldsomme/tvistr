"use client";

// The paid case (mockup, after payment): the same two panes as the flow before payment. Left: the
// letter unlocked with its copy buttons, the checklist, «Svarene dine» with a row per section, the
// strength of the case and «Lignende saker»; right: the whole letter from the server (fulltBrev),
// built from these answers with the car and the faults as bought. Every change is saved to the case.
import { useEffect, useState } from "react";
import { Hake, Kopier } from "@/app/deler/ikoner";
import { Lignende } from "@/app/deler/lignende";
import { fulltBrev } from "@/app/sak/brevet-actions";
import { Brevrute } from "@/app/sak/flyt/brevrute";
import { useBrev } from "@/app/sak/flyt/bruk-brev";
import { Oppsett } from "@/app/sak/flyt/oppsett";
import { Styrke } from "@/app/sak/flyt/styrke";
import { Topp } from "@/app/sak/flyt/topp";
import type { Sett } from "@/app/sak/skjema/felt";
import { ALLE, ETIKETT, ETTER, FOR, har, mangler, seksjonFor, stegFor } from "@/app/sak/skjema/steg";
import { idag } from "@/lib/app/dato";
import { datoavvik } from "@/lib/app/datoer";
import { orgValid, tall } from "@/lib/app/format";
import { type Skjema, syncAreas } from "@/lib/app/skjema";
import { medCelle, skriverResultat } from "@/lib/app/vurdering";
import { maal } from "@/lib/maling";
import { PRIS } from "@/lib/pris";
import { type Lagring, useAutolagring } from "./autolagring";
import { useLignende } from "./lignende";
import { radId, Svarene } from "./svarene";
import { useVedtak, Vedtaksvindu } from "./vedtaksvindu";

const LAGRING: Record<Lagring, string> = { lagret: "Lagret på kontoen din", endret: "Ikke lagret ennå", lagrer: "Lagrer …", feil: "Ikke lagret, prøver igjen" };
const ALLE_FELT = ALLE.flatMap((st) => st.felt);

export function Skriver({ id, start }: { id: string; start: Skjema }) {
  const [raa, settRaa] = useState<Skjema>(start);
  const lagring = useAutolagring(id, raa);
  const s = syncAreas(raa);
  const sett: Sett = (patch) => settRaa((f) => ({ ...f, ...patch }));
  const lignende = useLignende(s);
  const r = medCelle(skriverResultat(s, idag()), lignende?.ok ? lignende.celle : null);
  // The sections answered after payment start open while they lack something.
  const [apen, settApen] = useState<ReadonlySet<string>>(() => new Set(ETTER.filter((st) => st.felt.some((k) => !har(start, k))).map((st) => st.id)));
  const [vindu, settVindu] = useState(false);
  const apneVindu = () => settVindu(true);
  const lukkVindu = () => settVindu(false);
  // The decisions are looked up while no row that changes them is open (the sections before payment;
  // sender, recipient and the attachments do not), or while the dialog is.
  const vedtak = useVedtak(s, sett, id, vindu || !FOR.some((st) => apen.has(st.id)));
  const [toast, settToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => settToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const presedens = vedtak.venter ? "venter" : vedtak.valgt;
  const brev = useBrev(() => fulltBrev({ id, skjema: s, presedens }), JSON.stringify([id, s, presedens]));
  // Copying waits for the letter built from the answers as they are now; after a failed call the
  // letter shown is an older one.
  const klar = brev.svar && !brev.venter && !brev.feil ? brev.svar : null;

  const veksle = (sid: string, pa: boolean) =>
    settApen((a) => {
      const n = new Set(a);
      if (pa) n.add(sid);
      else n.delete(sid);
      return n;
    });
  // Opens a section's row (the faults only show, they are locked) and brings it into view.
  const tilRad = (sid: string) => {
    if (sid !== "feilen") veksle(sid, true);
    requestAnimationFrame(() => {
      const el = document.getElementById(radId(sid));
      // Smoothly unless the reader prefers less motion (html in globals.css).
      el?.scrollIntoView({ block: "start" });
      el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    });
  };

  async function kopier(tekst: string, ok: string) {
    try {
      await navigator.clipboard.writeText(tekst);
      settToast(ok);
    } catch {
      const el = document.querySelector(".fl-ark");
      if (el) {
        const rg = document.createRange();
        rg.selectNodeContents(el);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(rg);
      }
      settToast("Kopiering ble blokkert. Teksten er markert, trykk Ctrl/Cmd + C.");
    }
  }

  const rader = mangler(s);
  const avvik = [...datoavvik(s, idag()), ...(orgValid(s.d_org) === false ? ["Organisasjonsnummeret til forhandleren er ikke gyldig. Sjekk det mot Enhetsregisteret."] : [])];
  const nMangler = rader.reduce((a, x) => a + x.felt.length, 0);
  const etikett = nMangler ? `${nMangler} ${nMangler === 1 ? "opplysning" : "opplysninger"} mangler` : "Klart til å sendes";

  const venstre = (
    <>
      <div className="fl-apnet">
        <div className="fl-res">
          <span className="fl-betalt">
            <span aria-hidden="true">
              <Hake s={11} />
            </span>
            Betalt · kr {tall(PRIS)}
          </span>
          <h1>Brevet er låst opp</h1>
          <p>Hele brevet er fylt ut med svarene dine. Endre svarene under, så oppdateres brevet med en gang.</p>
        </div>
        <div className="fl-kopi">
          <button
            type="button"
            className="fl-cta"
            disabled={vedtak.venter || !klar}
            title={vedtak.venter ? "Venter på den lignende saken" : brev.feil ? "Brevet oppdateres ikke akkurat nå" : !klar ? "Brevet oppdateres" : undefined}
            onClick={() => {
              if (!klar) return;
              maal("brev_kopiert");
              kopier(klar.tekst, "Brevet er kopiert");
            }}
          >
            <Kopier />
            Kopier brevet
          </button>
          <button type="button" className="fl-knapp fl-knapp-s" disabled={!klar} onClick={() => klar && kopier(klar.emne, "Emnefeltet er kopiert")}>
            Kopier emnefelt
          </button>
        </div>
      </div>
      <p className="fl-hjelp">
        Lim inn brevet i en e-post til forhandleren, eller skriv det ut og send det rekommandert. Legg ved vedleggene som står i brevet.
      </p>
      {(avvik.length > 0 || rader.length > 0) && (
        <section className="fl-sjekk" aria-label="Sjekkliste">
          <h2>Sjekkliste</h2>
          {avvik.map((a) => (
            <div key={a} className="fl-sjekk-r">
              <span className="fl-sjekk-a">Sjekk</span>
              <span className="fl-sjekk-t">{a}</span>
            </div>
          ))}
          {rader.map((x) => (
            <div key={x.id} className="fl-sjekk-r">
              <span className="fl-sjekk-t">
                {x.navn}
                <small>{x.felt.map((k) => ETIKETT[k]).join(", ")}</small>
              </span>
              <button type="button" className="fl-knapp" onClick={() => tilRad(x.id)}>
                Fyll ut
              </button>
            </div>
          ))}
        </section>
      )}
      <Svarene s={s} sett={sett} apen={apen} settApen={veksle} vedtak={vedtak} onVedtak={apneVindu} />
      <Styrke r={r} apen onEndre={(f) => tilRad(stegFor(f.t))} />
      {lignende?.ok && (
        <Lignende
          overskrift={lignende.overskrift}
          tall={lignende.tall}
          kort={lignende.kort}
          sammenligning={lignende.sammenligning}
          brukes={s.prec_id}
          fot={
            <>
              Brevet viser til saken du har valgt, og forklarer hvorfor du har krav på samme resultat.{" "}
              <button type="button" className="lnk" onClick={apneVindu}>
                Velg vedtak
              </button>
            </>
          }
        />
      )}
      <p className="fine" style={{ margin: 0 }}>
        Brevet er en mal basert på forbrukerkjøpsloven og er ikke juridisk rådgivning. Forbrukerrådet gir gratis råd, og Forbrukertilsynet mekler hvis forhandleren avviser saken.{" "}
        <a href="/hvis-forhandleren-avviser" target="_blank" rel="noopener">
          Hva du kan gjøre hvis forhandleren avviser
        </a>
      </p>
      {vindu && <Vedtaksvindu vedtak={vedtak} sett={sett} onLukk={lukkVindu} />}
      <div className={`toast${toast ? " on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );

  return (
    <Oppsett
      topp={<Topp lagring={LAGRING[lagring]} aktivSak={id} />}
      venstre={venstre}
      brev={
        <Brevrute
          blokker={brev.blokker}
          venter={brev.venter}
          feil={brev.feil}
          etikett={etikett}
          onFelt={(felt) => (felt.startsWith("vedtak.") ? apneVindu() : tilRad(seksjonFor(felt)))}
        />
      }
      kikk={{ tekst: etikett, fylt: ALLE_FELT.length - nMangler, totalt: ALLE_FELT.length }}
    />
  );
}
