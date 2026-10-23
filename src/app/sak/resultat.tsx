// The verdict after the last question (mockup «Sjekk saken», the result): the level, title and summary
// of the verdict (past five years, the question about the exception instead of the purchase), the closest decision with medhold as a card, the purchase, the strength of the case
// with its rows, and «Lignende saker». A case the owner has bought already is opened instead: the
// answers just given are not carried over.
import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Kjop } from "@/app/deler/kjop";
import { useInne } from "@/app/deler/konto";
import { Lignende } from "@/app/deler/lignende";
import { Styrke } from "@/app/sak/flyt/styrke";
import type { Forhandsvist } from "@/app/sak/brevet-actions";
import { cap, tall } from "@/lib/app/format";
import { useKjopt } from "@/lib/app/lagring";
import { type Kjopt, manglerISkjema, sakTekst, sammeSakSkjema } from "@/lib/app/saken";
import type { Utkast } from "@/lib/app/utkast";
import type { Resultat as Vurdering } from "@/lib/app/vurdering";
import { maal } from "@/lib/maling";
import { PRIS } from "@/lib/pris";
import { mineKjop } from "./mine";


// «Endre svarene» goes back to the last question; «Start på nytt» replaces the draft with a new one.
const Lenker = ({ onEndre, onNy }: { onEndre: () => void; onNy: () => void }) => (
  <div className="fl-lenker">
    <button type="button" className="fl-lenke" onClick={onEndre}>
      Endre svarene
    </button>
    <button type="button" className="fl-lenke" onClick={onNy}>
      Start på nytt
    </button>
  </div>
);

type Lignende = NonNullable<Extract<Forhandsvist, { ok: true }>["lignende"]>;

export function Resultat({
  utkast,
  r,
  lignende,
  utvikling,
  onEndre,
  onNy,
  onTilSkjerm,
  onUnntak,
  tittel,
}: {
  utkast: Utkast;
  r: Vurdering;
  lignende: Lignende | null;
  utvikling: boolean;
  onEndre: () => void;
  onNy: () => void;
  onTilSkjerm: (id: string) => void;
  // Past five years: the buyer says the dealer held something back, or a warranty runs longer.
  onUnntak: () => void;
  // The heading, focused when the result opens (as each question's is).
  tittel: RefObject<HTMLHeadingElement | null>;
}) {
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
  const inne = useInne();
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
        <h1 ref={tittel} tabIndex={-1}>
          {r.title}
        </h1>
        <p>{r.summary}</p>
      </div>
      {r.tier === "utenfor" || r.tier === "frist" ? (
        <div className="fl-kjop">
          <ul className="fl-rad">
            {r.advice?.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {r.tier === "frist" && (
            <div className="fl-varsel fl-varsel-stabel">
              <span>Holdt forhandleren tilbake noe om feilen, eller gir en garanti lengre frist enn fem år?</span>
              <button type="button" className="lnk" onClick={onUnntak}>
                Ja, se vurderingen
              </button>
            </div>
          )}
          <Lenker onEndre={onEndre} onNy={onNy} />
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
              <div className="fl-varsel fl-varsel-stabel">
                <span>
                  {mangler === "reg"
                    ? "Legg inn registreringsnummeret først. Brevet gjelder bilen du betaler for."
                    : mangler === "bil"
                      ? "Hent bilen fra Vegvesen eller skriv inn merke og modell først. Brevet gjelder bilen du betaler for, og den kan ikke endres etterpå."
                      : "Velg hvilken feil det gjelder først. Brevet gjelder feilen du betaler for."}
                </span>
                <button type="button" className="lnk" onClick={() => onTilSkjerm(mangler === "feil" ? "feil" : "bilen")}>
                  {mangler === "feil" ? "Velg feilen" : "Legg inn bilen"}
                </button>
              </div>
            ) : henter ? (
              <button type="button" className="fl-cta" aria-disabled="true" aria-busy="true">
                Sjekker kjøpene dine …
              </button>
            ) : (
              <>
                <button type="button" className="fl-cta" onClick={apne}>
                  Lås opp hele brevet · kr {tall(PRIS)}
                </button>
                <span className="fl-fin">Du betaler med Vipps. Svarene dine er allerede fylt inn.</span>
                <span className="fl-fin">
                  Brevet gjelder {`${s.c_make} ${s.c_model}`.trim()} ({s.c_reg}) og feilen du har valgt. Bilen og feilen kan ikke endres etter kjøpet.
                </span>
              </>
            )}
            <Lenker onEndre={onEndre} onNy={onNy} />
          </div>
        </>
      )}
      <Styrke r={r} apen />
      {r.tier !== "utenfor" && r.tier !== "frist" && lignende && <Lignende overskrift={lignende.overskrift} tall={lignende.tall} kort={lignende.kort} sammenligning={lignende.sammenligning} fot="I brevet viser vi til et vedtak som ligner saken din, og argumenterer for at din sak bør få samme utfall." />}
      <p className="fine" style={{ margin: 0 }}>
        Vurderingen er veiledende og bygger bare på svarene dine. Den er ikke juridisk rådgivning.
      </p>
      {createPortal(<Kjop utkast={utkast} utvikling={utvikling} apen={kjop && !funnet && !mangler} onLukk={() => settKjop(false)} />, document.body)}
    </>
  );
}
