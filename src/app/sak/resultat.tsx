"use client";

// The verdict after the last question (mockup «Sjekk saken», the result): the level, title and summary
// of the verdict, the closest decision with medhold as a card, the purchase, the strength of the case
// with its rows, and «Lignende saker». A case the owner has bought already is opened instead: the
// answers just given are not carried over.
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Kjop } from "@/app/deler/kjop";
import { Lignende } from "@/app/deler/lignende";
import { Styrke } from "@/app/sak/flyt/styrke";
import type { Forhandsvist } from "@/app/sak/brevet-actions";
import { cap, tall } from "@/lib/app/format";
import { useKjopt } from "@/lib/app/lagring";
import { type Kjopt, manglerISkjema, sakTekst, sammeSakSkjema } from "@/lib/app/saken";
import type { Utkast } from "@/lib/app/utkast";
import type { Resultat as Vurdering } from "@/lib/app/vurdering";
import { inneHint } from "@/lib/innlogging/navn";
import { maal } from "@/lib/maling";
import { GRATIS, PRIS } from "@/lib/pris";
import { mineKjop } from "./mine";

const PRISTEKST = GRATIS ? "Gratis" : `kr ${tall(PRIS)}`;
const BETALER_FOR = GRATIS ? "som brevet skal gjelde" : "du betaler for";
const ingen = () => () => {};

type Lignende = NonNullable<Extract<Forhandsvist, { ok: true }>["lignende"]>;

export function Resultat({ utkast, r, lignende, utvikling, onEndre, onTilSkjerm }: { utkast: Utkast; r: Vurdering; lignende: Lignende | null; utvikling: boolean; onEndre: () => void; onTilSkjerm: (id: string) => void }) {
  const router = useRouter();
  const s = utkast.skjema;
  // The case bought last in this browser, and the owner's cases from the account: one for the same car
  // and faults is opened instead of bought again (kjop refuses a second purchase on the server too).
  const [kjopt] = useKjopt();
  const [mine, settMine] = useState<Kjopt[] | null>(null);
  useEffect(() => {
    mineKjop().then(settMine, () => settMine([]));
  }, []);
  const funnet = [kjopt, ...(mine ?? [])].find((k) => sammeSakSkjema(s, k));
  // Logged in (by the hint) and the account's cases not here yet: no pay button until we know.
  const inne = useSyncExternalStore(ingen, inneHint, () => false);
  const henter = !funnet && mine === null && inne;
  const mangler = manglerISkjema(s);
  const [kjop, settKjop] = useState(false);

  const kategorier = s.f_cats.flatMap((c) => [c, ...(s.f_parts[c] ?? []).map((u) => `${c}.${u}`)]);
  useEffect(() => {
    if (r.tier !== "ukjent") maal("resultat_vist", { status: r.tier, kategorier });
    // Once per verdict shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.tier]);

  const apne = () => {
    maal("kjop_klikket");
    settKjop(true);
  };
  const k = lignende?.kort[0];

  return (
    <>
      <div className="fl-res">
        <span className="fl-merkelapp" data-niva={r.tier}>
          <i aria-hidden="true" />
          {r.badge}
        </span>
        <h1>{r.title}</h1>
        <p>{r.summary}</p>
      </div>
      {r.tier === "utenfor" ? (
        <div className="fl-kjop">
          <ul className="fl-rad">
            {r.advice?.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <button type="button" className="fl-lenke" onClick={onEndre}>
            Endre svarene
          </button>
        </div>
      ) : (
        <>
          {k && (
            <div className="fl-kort">
              <div className="fl-kort-h">
                <span className="fl-kort-m">
                  {sakTekst(k.saksnummer, k.ar)} · {k.bil}
                </span>
                <span className="fl-tag">{k.fikk[0] ? cap(k.fikk[0]) : "Medhold"}</span>
              </div>
              {k.feil && <p>{cap(k.feil)}</p>}
            </div>
          )}
          <div className="fl-kjop">
            {funnet ? (
              <>
                <p className="fl-varsel">Du har alt et brev for denne bilen og feilen. Svarene du har fylt inn nå, blir ikke overført.</p>
                <button type="button" className="fl-cta" onClick={() => router.push(`/sak/${funnet.id}`)}>
                  Åpne brevet
                </button>
              </>
            ) : mangler ? (
              <p className="fl-varsel">
                {mangler === "reg"
                  ? `Legg inn registreringsnummeret først. Brevet gjelder bilen ${BETALER_FOR}.`
                  : mangler === "bil"
                    ? `Hent bilen fra Vegvesen eller skriv inn merke og modell først. Brevet gjelder bilen ${BETALER_FOR}, og den kan ikke endres etterpå.`
                    : `Velg hvilken feil det gjelder først. Brevet gjelder feilen ${BETALER_FOR}.`}{" "}
                <button type="button" className="lnk" onClick={() => onTilSkjerm(mangler === "feil" ? "feil" : "bilen")}>
                  {mangler === "feil" ? "Velg feilen" : "Legg inn bilen"}
                </button>
              </p>
            ) : henter ? (
              <button type="button" className="fl-cta" aria-disabled="true" aria-busy="true">
                Sjekker kjøpene dine …
              </button>
            ) : (
              <>
                <button type="button" className="fl-cta" onClick={apne}>
                  Lås opp hele brevet · {PRISTEKST}
                </button>
                <span className="fl-fin">{GRATIS ? "Svarene dine er allerede fylt inn." : "Du betaler med Vipps. Svarene dine er allerede fylt inn."}</span>
                <span className="fl-fin">
                  Brevet gjelder {`${s.c_make} ${s.c_model}`.trim()} ({s.c_reg}) og feilen du har valgt. Bilen og feilen kan ikke endres {GRATIS ? "etterpå" : "etter kjøpet"}.
                </span>
              </>
            )}
            <button type="button" className="fl-lenke" onClick={onEndre}>
              Endre svarene
            </button>
          </div>
        </>
      )}
      <Styrke r={r} apen />
      {r.tier !== "utenfor" && lignende && <Lignende tall={lignende.tall} kort={lignende.kort} sammenligning={lignende.sammenligning} fot="I brevet viser vi til et vedtak som ligner saken din, og argumenterer for at din sak bør få samme utfall." />}
      <p className="fine" style={{ margin: 0 }}>
        Vurderingen er veiledende og bygger bare på svarene dine. Den er ikke juridisk rådgivning.
      </p>
      {createPortal(<Kjop utkast={utkast} utvikling={utvikling} apen={kjop && !funnet && !mangler} onLukk={() => settKjop(false)} />, document.body)}
    </>
  );
}
