"use client";

// The flow before payment (mockup «Sjekk saken»): one question per screen on the left with the strength
// of the case under it, the letter as the answers make it on the right (built and redacted on the
// server, forhandsvis), then the verdict and the purchase. The draft stays in localStorage
// (tvistr-utkast); nothing is saved on the server before kjop.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pil } from "@/app/deler/ikoner";
import { MaalVisning } from "@/app/maal-visning";
import { forhandsvis } from "@/app/sak/brevet-actions";
import { useBrev } from "@/app/sak/flyt/bruk-brev";
import { Brevrute } from "@/app/sak/flyt/brevrute";
import { Oppsett } from "@/app/sak/flyt/oppsett";
import { Styrke } from "@/app/sak/flyt/styrke";
import { Topp } from "@/app/sak/flyt/topp";
import { Bilen, Kjopet } from "@/app/sak/skjema/bilen";
import type { Sett, StegProps } from "@/app/sak/skjema/felt";
import { Krav } from "@/app/sak/skjema/krav";
import { Feilvalg, Omrader, SagtFra, SelgerSa, Verksted, Virkning } from "@/app/sak/skjema/mangelen";
import { ETIKETT, FOR, har } from "@/app/sak/skjema/steg";
import { idag } from "@/lib/app/dato";
import { erObjekt, flett } from "@/lib/app/flett";
import { useLagret } from "@/lib/app/lagring";
import { type Skjema, standard, syncAreas } from "@/lib/app/skjema";
import { standardUtkast, type Utkast, utkastResultat } from "@/lib/app/utkast";
import { Resultat } from "./resultat";
import { ENKELTVALG, synlige } from "./sporsmal";

type Lagret = Utkast & { _i?: number; _screen?: "q" | "result" };

const NOKKEL = "tvistr-utkast";
const ADV_MS = 750;
type Nokkel = Parameters<typeof har>[1];
// The field the peek bar names for a change of the per-area answers.
const SOM: Record<string, Nokkel> = { f_area: "f_found", f_catdesc: "f_any_desc" };

// The form inside the draft over the defaults, so a draft stored by an older version has every field.
const medSkjema = (l: Lagret): Lagret => ({ ...l, skjema: flett(standard(idag()), erObjekt(l.skjema) ? l.skjema : {}) as Skjema });

// The component of each screen that is not one choice (sporsmal.ts, ENKELTVALG).
const STEG: Record<string, (p: StegProps) => ReactNode> = {
  bilen: Bilen,
  kjopet: (p) => <Kjopet {...p} medForbehold={false} />,
  feil: Feilvalg,
  omrader: Omrader,
  virkning: Virkning,
  verksted: Verksted,
  selger_sa: SelgerSa,
  sagt_fra: SagtFra,
  kravet: Krav,
};

export function Sjekk({ utvikling, fraStart, ny }: { utvikling: boolean; fraStart: boolean; ny: boolean }) {
  const router = useRouter();
  const [raa, settRaa, klar] = useLagret<Lagret>(NOKKEL, () => ({ ...standardUtkast(idag()), _i: 0 }));
  const lagret = useMemo(() => medSkjema(raa), [raa]);
  const [adv, settAdv] = useState<string | null>(null);
  // The field the buyer changed last, for the peek bar on narrow screens.
  const [sist, settSist] = useState<Nokkel | null>(null);
  const tid = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tittel = useRef<HTMLHeadingElement>(null);

  // What the server and the verdict get: the draft without the position.
  const utkast = useMemo<Utkast>(() => ({ skjema: lagret.skjema, seller: lagret.seller, buyer: lagret.buyer, asis: lagret.asis }), [lagret]);
  const dag = idag();
  const s = syncAreas(utkast.skjema);
  const r = utkastResultat(utkast, dag);
  const vis = synlige(utkast);
  const i = Math.min(lagret._i ?? 0, vis.length - 1);
  const sk = vis[i];
  const skjerm = lagret._screen ?? "q";
  const brev = useBrev(() => forhandsvis({ utkast }), JSON.stringify(utkast));

  const endre = useCallback((f: (l: Lagret) => Lagret) => settRaa((l) => f(medSkjema(l))), [settRaa]);
  const sett: Sett = (patch) => {
    endre((l) => ({ ...l, skjema: { ...l.skjema, ...patch } }));
    const k = Object.keys(patch).map((k) => SOM[k] ?? k).find((k) => k in ETIKETT);
    settSist((k as Nokkel | undefined) ?? null);
  };

  const avbryt = useCallback(() => {
    clearTimeout(tid.current);
    settAdv(null);
  }, []);
  const neste = useCallback(() => {
    avbryt();
    endre((l) => {
      const v = synlige(l);
      const n = Math.min(l._i ?? 0, v.length - 1);
      if (!v[n].ferdig(l)) return l;
      return n >= v.length - 1 ? { ...l, _screen: "result" } : { ...l, _i: n + 1 };
    });
  }, [avbryt, endre]);
  const tilbake = () => {
    avbryt();
    endre((l) => ({ ...l, _i: Math.max(0, Math.min(l._i ?? 0, synlige(l).length - 1) - 1) }));
  };
  const tilSkjerm = (id: string) => {
    avbryt();
    endre((l) => ({ ...l, _screen: "q", _i: Math.max(0, synlige(l).findIndex((x) => x.id === id)) }));
  };
  // «Start på nytt»: a new draft from question 1, as `/sak?ny`.
  const nyttUtkast = () => {
    avbryt();
    settSist(null);
    settRaa({ ...standardUtkast(idag()), _i: 0 });
  };
  // «Neste» pressed on a screen that is not done: the screen it was pressed on, so the line under the
  // buttons says what is missing until the screen is done or another one opens.
  const [trykket, settTrykket] = useState<string | null>(null);

  // A choice goes on by itself once the screen is done (not for a case the letter does not cover).
  function velg(id: string, v: string) {
    const e = ENKELTVALG[id];
    avbryt();
    endre((l) => ({ ...l, ...e.sett(l, v) }));
    if (!sk.ferdig(e.sett(utkast, v))) return;
    settAdv(v);
    tid.current = setTimeout(neste, matchMedia("(prefers-reduced-motion: reduce)").matches ? 450 : ADV_MS);
  }
  useEffect(() => () => clearTimeout(tid.current), []);

  // Once the stored draft is read: `?ny` starts a new draft; `?start` (the front page) opens question 1
  // with the answers kept. The parameter is dropped so a reload stays where the buyer is.
  useLayoutEffect(() => {
    if (!klar) return;
    if (ny) settRaa({ ...standardUtkast(idag()), _i: 0 });
    else if (fraStart) settRaa((l) => ({ ...l, _screen: "q", _i: 0 }));
    if (ny || fraStart) router.replace("/sak");
  }, [klar, ny, fraStart, settRaa, router]);

  // A new screen starts at the top, with its question focused (not on the first paint).
  const forrige = useRef<string | null>(null);
  const her = `${skjerm}-${i}`;
  useEffect(() => {
    if (!klar) return;
    if (forrige.current !== null && forrige.current !== her) {
      window.scrollTo({ top: 0 });
      tittel.current?.focus({ preventScroll: true });
    }
    forrige.current = her;
  }, [klar, her]);

  // «x av N opplysninger»: the fields of the sections answered before payment.
  const felt = FOR.flatMap((f) => f.felt);
  const fylt = felt.filter((k) => har(s, k)).length;
  const etikett = `${fylt} av ${felt.length} opplysninger fylt inn`;

  const ferdig = sk.ferdig(utkast);
  const siste = i === vis.length - 1;
  const Steget = STEG[sk.id];
  const valg = ENKELTVALG[sk.id];

  const venstre = !klar ? null : skjerm === "result" ? (
    <Resultat utkast={utkast} r={r} lignende={brev.svar?.lignende ?? null} utvikling={utvikling} onEndre={() => tilSkjerm(vis.at(-1)!.id)} onNy={nyttUtkast} onTilSkjerm={tilSkjerm} tittel={tittel} />
  ) : (
    <>
      {i === 0 && <MaalVisning hendelse="sjekk_startet" />}
      <div className="fl-frem">
        <div className="fl-frem-l">
          <span className="fl-frem-g">{sk.gruppe}</span>
          <span>
            Spørsmål {i + 1} av {vis.length}
          </span>
        </div>
        <div className="fl-frem-s" aria-hidden="true">
          {vis.map((x, j) => (
            <span key={x.id} data-s={j < i ? "ferdig" : j === i ? "her" : undefined} />
          ))}
        </div>
      </div>
      <div className="fl-sp">
        <h1 ref={tittel} tabIndex={-1}>
          {sk.tittel}
        </h1>
        {sk.hint && <p>{sk.hint}</p>}
      </div>
      <div className="fl-skjerm">
        {valg ? (
          <div className="fl-valg" role="radiogroup" aria-label={sk.tittel}>
            {valg.valg.map(([v, t, d]) => {
              const pa = valg.verdi(utkast) === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={pa} className="fl-valg-r" data-adv={adv === v || undefined} onClick={() => velg(sk.id, v)}>
                  <span className="fl-valg-o" aria-hidden="true" />
                  <span className="fl-valg-t">
                    <b>{t}</b>
                    {d && <small>{d}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Steget s={s} sett={sett} />
        )}
        {/* Only where this screen's own answer puts the case outside what the letter covers. */}
        {sk.id === "selger" && r.tier === "utenfor" && (
          <div className="fl-varsel" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l10 18H2zM12 10v4M12 17.5h.01" />
            </svg>
            <div>
              <b>{r.title}</b>
              <p>{r.summary}</p>
              <ul>
                {r.advice?.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      <div className="fl-nav">
        {i > 0 && (
          <button type="button" className="fl-tilbake" aria-label="Tilbake" onClick={tilbake}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <button type="button" className="fl-cta" aria-disabled={!ferdig} onClick={() => (ferdig ? neste() : settTrykket(her))}>
          {adv ? "Går videre …" : siste ? "Se vurderingen" : "Neste"}
          <Pil s={17} w={2.2} />
        </button>
        <p className="fl-mangler" role="status">
          {trykket === her && !ferdig ? sk.mangler?.(utkast) : null}
        </p>
      </div>
      <Styrke r={r} apen={false} />
    </>
  );

  const kikk = { tekst: sist && har(s, sist) ? `Lagt til i brevet: ${ETIKETT[sist]}` : "", fylt, totalt: felt.length };
  return (
    <Oppsett
      topp={<Topp lagring="Lagret i nettleseren" />}
      venstre={venstre}
      brev={<Brevrute blokker={brev.blokker} venter={brev.venter} feil={brev.feil} etikett={etikett} />}
      kikk={kikk}
    />
  );
}
