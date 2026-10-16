// The verdict of the free check (artifact resultHTML): tier, law rows, «Lignende saker» from the
// database, and the offer. Unlocking prefills the writer and opens it.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hake, InfoSirkel, Pil, Tilbake } from "@/app/deler/ikoner";
import { Kjop } from "@/app/deler/kjop";
import { Lignende } from "@/app/deler/lignende";
import { Lovrader } from "@/app/deler/lovrader";
import { idag } from "@/lib/app/dato";
import { tall } from "@/lib/app/format";
import { skriv, useLagret } from "@/lib/app/lagring";
import { maal } from "@/lib/maling";
import { manglerForKjop, nokkel, nyttKjop, sammeSak, sjekkTilSvar } from "@/lib/app/saken";
import { type Skjema, standard } from "@/lib/app/skjema";
import { evaluate } from "@/lib/app/vurdering";
import { opplysningsfeil } from "@/lib/brev/feiltype";
import { PRIS } from "@/lib/pris";
import { type Lignende as LignendeSvar, vurderSaken } from "./vurdering";
import type { Tilstand } from "./sjekk";

const PRISTEKST = `kr ${tall(PRIS)}`;
const FORDELER = [
  "Ferdig brev med riktige lovhenvisninger for din sak",
  "Fristvurdering og bevisbyrde regnet ut automatisk",
  "Krav om retting, omlevering, prisavslag, heving og erstatning",
  "Svarene dine fra vurderingen er allerede fylt inn",
  "Kopier brevet og send det på e-post samme dag",
];

export function Resultat({ a, ordre, utvikling, onTilbake, onOmStart, onTilSporsmal }: { a: Tilstand; ordre: string; utvikling: boolean; onTilbake: () => void; onOmStart: () => void; onTilSporsmal: (id: "reg" | "cats") => void }) {
  const router = useRouter();
  const datoer = (a.cats ?? []).map((c) => a.fdates?.[c]).filter((d): d is string => !!d).sort();
  const opplysning = !!a.cats?.length && a.cats.every((c) => opplysningsfeil(c, a.issues?.[c] ?? []));
  // The writer bought earlier is locked to its car and faults; this check may be about another.
  const [skjema] = useLagret<Skjema>("tvistr-skjema", () => standard(idag()));
  const tilgang = !!ordre && sammeSak(a, skjema);
  const mangler = manglerForKjop(a);
  const [visMangler, settVisMangler] = useState(false);
  const r = evaluate({ ...a, found: datoer[0], sist: datoer.at(-1), opplysning }, idag());
  const [lignende, settLignende] = useState<LignendeSvar | null>(null);
  const [kjop, settKjop] = useState(false);
  const [unna, settUnna] = useState(false);
  const tilbud = useRef<HTMLElement>(null);
  const svar = r.tier === "utenfor" ? null : sjekkTilSvar(a);
  const n = nokkel(svar);

  useEffect(() => {
    if (!svar) return;
    let gjeldende = true;
    vurderSaken(svar).then((x) => gjeldende && settLignende(x));
    return () => {
      gjeldende = false;
    };
    // `n` is the answers the cases are for: fetched again only when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const kategorier = (a.cats ?? []).flatMap((c) => [c, ...(a.issues?.[c] ?? []).map((u) => `${c}.${u}`)]);
  useEffect(() => {
    if (r.tier !== "ukjent") maal("resultat_vist", { status: r.tier, kategorier });
    // Once per verdict shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.tier]);

  useEffect(() => {
    const el = tilbud.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => settUnna(e.isIntersecting)), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A purchase is for this car and these faults: the writer starts a new letter for them.
  function betalt(ordreId: string) {
    maal("betaling_fullfort");
    skriv("tvistr-ordre", ordreId);
    skriv("tvistr-skjema", nyttKjop(a, skjema, idag()));
    router.push("/brev");
  }

  const apne = () => {
    if (tilgang) return router.push("/brev");
    if (mangler) return settVisMangler(true);
    maal("kjop_klikket");
    settKjop(true);
  };
  const knappetekst = tilgang ? "Åpne brevskriveren" : ordre ? "Lås opp for denne saken" : "Lås opp brevskriveren";
  const knapper = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" className="btn" onClick={onTilbake}>
        <Tilbake />
        Endre svar
      </button>
      <button type="button" className="btn gh" onClick={onOmStart}>
        Start på nytt
      </button>
    </div>
  );

  if (r.tier === "utenfor")
    return (
      <div className="res" style={{ gridTemplateColumns: "minmax(0,720px)", justifyContent: "center" }}>
        <div className="res-main stag">
          <div className="verdict t-utenfor">
            <span className="vbadge">
              <i />
              {r.badge}
            </span>
            <h2>{r.title}</h2>
            <p>{r.summary}</p>
          </div>
          <div className="nsteps">
            <div className="offer-k">Dette kan du gjøre</div>
            {r.advice!.map((t, i) => (
              <div key={t} className="ns">
                <b>Steg {i + 1}</b>
                <span>{t}</span>
              </div>
            ))}
          </div>
          {knapper}
        </div>
      </div>
    );

  return (
    <>
      <div className="res">
        <div className="res-main stag">
          <div className={`verdict t-${r.tier}`}>
            <span className="vbadge">
              <i />
              {r.badge}
            </span>
            <h2>{r.title}</h2>
            <p>{r.summary}</p>
            {r.pos && (
              <div className="m3" aria-hidden="true">
                <div className="m3-bar">
                  <span />
                  <span />
                  <span />
                  <i style={{ left: r.pos }} />
                </div>
                <div className="m3-l">
                  <span>Svak</span>
                  <span>Usikker</span>
                  <span>Sterk</span>
                </div>
              </div>
            )}
          </div>
          <Lovrader faktorer={r.factors} />
          {lignende?.ok && <Lignende tall={lignende.tall} kort={lignende.kort} sammenligning={lignende.sammenligning} fot="I brevet viser vi til saken som ligner mest, og forklarer hvorfor du har krav på samme resultat." />}
          {knapper}
          <p className="fine" style={{ margin: "4px 0 0" }}>
            Vurderingen er veiledende og bygger bare på svarene dine. Den er ikke juridisk rådgivning.
          </p>
        </div>
        <aside ref={tilbud} className="offer anim-f" aria-label="Brevskriveren">
          <div className="offer-k">{tilgang ? "Du har tilgang" : ordre ? "Ny sak" : "Neste steg"}</div>
          <h3>{r.tier === "svak" ? "Vil du reklamere likevel?" : "Skriv reklamasjonsbrevet"}</h3>
          {!!ordre && !tilgang && (
            <div className="demo-note">
              <InfoSirkel />
              <span>
                Brevskriveren er låst opp for {skjema.c_reg || "en annen bil"}. Et brev for en annen bil eller feil krever et nytt kjøp.{" "}
                <button type="button" className="lnk" onClick={() => router.push("/brev")}>
                  Åpne brevet for {skjema.c_reg || "den bilen"}
                </button>
              </span>
            </div>
          )}
          {!tilgang && (
            <div className="price">
              <b>{PRISTEKST}</b>
              <span>engangsbeløp</span>
            </div>
          )}
          <ul className="feats">
            <li>
              <Hake s={13} />
              <span>
                <b style={{ color: "var(--ink)", fontWeight: 600 }}>Argumentasjon med en vunnet, lignende sak fra Forbrukerklageutvalget</b>
              </span>
            </li>
            {FORDELER.map((t) => (
              <li key={t}>
                <Hake s={13} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {visMangler && mangler && (
            <div className="demo-note">
              <InfoSirkel />
              <span>
                {mangler === "reg" ? "Legg inn registreringsnummeret først. Brevet gjelder bilen du betaler for." : "Velg hvilken feil det gjelder først. Brevet gjelder feilen du betaler for."}{" "}
                <button type="button" className="lnk" onClick={() => onTilSporsmal(mangler === "reg" ? "reg" : "cats")}>
                  {mangler === "reg" ? "Legg inn bilen" : "Velg feilen"}
                </button>
              </span>
            </div>
          )}
          {!tilgang && !mangler && (
            <p className="fine" style={{ margin: 0 }}>
              Brevet gjelder {a.reg} og feilen du har valgt.
            </p>
          )}
          <button type="button" className="btn pri" onClick={apne}>
            {knappetekst}
            <Pil />
          </button>
          <p className="fine" style={{ margin: 0 }}>
            {r.tier === "svak" ? "Usikker? Forbrukerrådet gir gratis råd før du bestemmer deg." : "Ikke juridisk rådgivning. Du bestemmer selv hva du sender."}
          </p>
        </aside>
      </div>
      {/* Outside the animated stage: a transform there would pin «fixed» to the stage. */}
      {createPortal(
        <>
          <div className={`res-bar${unna ? " away" : ""}`}>
            <div className="res-bar-t">
              <b>{tilgang ? "Du har tilgang" : PRISTEKST}</b>
              <span>Brev med vunnet, lignende sak</span>
            </div>
            <button type="button" className="btn pri" onClick={apne}>
              {tilgang ? "Åpne brevskriveren" : "Lås opp brevet"}
              <Pil />
            </button>
          </div>
          <Kjop utvikling={utvikling} apen={kjop} onLukk={() => settKjop(false)} onBetalt={betalt} />
        </>,
        document.body,
      )}
    </>
  );
}
