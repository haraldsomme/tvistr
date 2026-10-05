"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/app/logo";
import { FEILTYPE_TEKST } from "@/app/vurdering/tekster";
import type { Lagring, Utfylling } from "@/lib/brev/utfylling";
import { tilKlageInput, type Innsending } from "@/lib/vurdering/innsending";
import { Button } from "@/components/ui/button";
import { useBekreftLagring } from "../bekreft";
import { VEIVISER_KNAPPER, VeiviserKontekst } from "../felt";
import { Intervju, type IntervjuUtkast } from "../feilen/intervju";
import { lagSteg, type StegId } from "../steg/liste";

// The wizard after buying: a thank-you, then every fill-in step of the letter on a screen of its own,
// then the letter. Every step can be skipped; what is missing stays yellow in the letter and open
// beside it. The steps are the same components as on the letter page (`steg/liste.tsx`); the wizard
// gives their forms «Neste», «Tilbake» and «Hopp over» through `VeiviserKontekst`.

type Skjerm = "intro" | StegId;

function Ramme({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#e9e6df] font-ui text-[#17263d]">
      <div className="flex items-center border-b border-[#d3cec3] bg-[#f6f4ef] px-6 pb-[18px] pt-[52px] md:px-16 md:py-[22px]">
        <Logo liten />
      </div>
      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-32 pt-6 md:px-16 md:pb-[72px] md:pt-12">{children}</main>
    </div>
  );
}

export function Veiviser({
  id,
  startSvar,
  startUtfylling,
  idag,
  forslagKjopsdato,
  startSteg,
  tilbakeTilBrev,
}: {
  id: string;
  startSvar: Innsending;
  startUtfylling: Utfylling;
  // From the server, so dates are the same on both sides of hydration.
  idag: string;
  forslagKjopsdato: string | null;
  startSteg: StegId | null;
  // Opened from the letter to change one step: only that step, and back to the letter after.
  tilbakeTilBrev: boolean;
}) {
  const router = useRouter();
  const idBase = useId();
  const [svar, setSvar] = useState(startSvar);
  const [utfylling, setUtfylling] = useState(startUtfylling);
  const [feil, setFeil] = useState<string | null>(null);
  // What the buyer has typed in «Feilen», kept while other steps are open.
  const [intervjuUtkast, setIntervjuUtkast] = useState<IntervjuUtkast | null>(null);
  const parsed = tilKlageInput(svar, idag);
  const input = parsed.ok ? parsed.input : null;

  // Saves one step, as the letter page does, and keeps what the server stored.
  async function lagre(lagring: Lagring): Promise<boolean> {
    setFeil(null);
    try {
      const res = await fetch(`/api/sak/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lagring) });
      const json = (await res.json()) as { svar?: Innsending; utfylling?: Utfylling; feil?: string };
      if (!res.ok || !json.utfylling) throw new Error(json.feil ?? "");
      if (json.svar) setSvar(json.svar);
      setUtfylling(json.utfylling);
      return true;
    } catch (e) {
      setFeil((e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError) && e.message) || "Vi fikk ikke lagret. Prøv igjen om litt.");
      return false;
    }
  }

  const bekreft = useBekreftLagring(lagre, { svar, utfylling }, idag);
  const steg = input ? lagSteg({ sakId: id, input, svar, utfylling, idag, idBase, forslagKjopsdato, lagre: bekreft.lagre }) : [];
  // A step given in the address; else the thank-you while nothing has been filled in (some steps are
  // done from the assessment's answers alone); else the first step not done.
  const nySak = Object.keys(startUtfylling).every((k) => k === "kjoretoy" || k === "sprakvask");
  const [skjerm, setSkjerm] = useState<Skjerm>(() => startSteg ?? (nySak ? "intro" : (steg.find((s) => !s.ferdig)?.id ?? steg[steg.length - 1]?.id ?? "intro")));

  // Each new screen moves focus to its heading, so a screen reader hears where it is.
  const overskrift = useRef<HTMLHeadingElement>(null);
  const forsteSkjerm = useRef(true);
  useEffect(() => {
    if (forsteSkjerm.current) {
      forsteSkjerm.current = false;
      return;
    }
    overskrift.current?.focus();
  }, [skjerm]);

  // A correction that makes the answers stop giving a letter is handled on the letter page.
  useEffect(() => {
    if (!input) router.replace(`/brev/${id}`);
  }, [input, id, router]);
  if (!input) return null;

  const nr = steg.findIndex((s) => s.id === skjerm);
  const gaTil = (s: Skjerm) => {
    setFeil(null);
    setSkjerm(s);
    window.scrollTo({ top: 0 });
  };

  // The end: the case is marked as gone through once, so the link opens the letter from now on.
  async function slutt() {
    if (!utfylling.gjennomgatt && !(await lagre({ gjennomgatt: true }))) {
      return;
    }
    router.push(`/brev/${id}`);
  }
  const neste = () => (tilbakeTilBrev || nr === steg.length - 1 ? slutt() : gaTil(steg[nr + 1].id));
  const tilbake = () => (tilbakeTilBrev ? router.push(`/brev/${id}`) : gaTil(nr <= 0 ? "intro" : steg[nr - 1].id));
  // From the letter, «Tilbake» already goes back to it without saving.
  const hoppOver = tilbakeTilBrev ? undefined : neste;

  const feilmelding = feil && (
    <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
      {feil}
    </p>
  );

  if (skjerm === "intro") {
    return (
      <Ramme>
        <h1 ref={overskrift} tabIndex={-1} className="m-0 font-brev text-[32px] font-semibold leading-[1.15] outline-none md:text-[40px]">Takk! Nå lager vi brevet ditt.</h1>
        <p className="m-0 max-w-[640px] text-[16px] leading-[1.6] text-[#3d4757]">
          Vi stiller deg noen spørsmål om kjøpet, feilen og hva som har skjedd siden. Svarene blir til brevet, så ta deg god tid og svar så presist du kan. Har du kjøpekontrakten, annonsen og meldingene med forhandleren for hånden, går det raskere. Det tar omtrent 10–15 minutter. Det du ikke vet nå, kan du hoppe over og fylle ut senere.
        </p>
        <div className={VEIVISER_KNAPPER}>
          <Button type="button" onClick={() => gaTil(steg[0].id)} className="w-full md:w-auto">
            Start
          </Button>
        </div>
      </Ramme>
    );
  }

  const aktivt = steg[nr];
  let innhold: ReactNode;
  if (aktivt.id === "feilen") {
    innhold = (
      <>
        <Intervju
          id={id}
          svar={svar}
          idag={idag}
          feiltyper={[...new Set(input.feilen.typer)].map((t) => FEILTYPE_TEKST[t])}
          forslagKjopsdato={forslagKjopsdato}
          verdi={utfylling.feilen}
          utkast={intervjuUtkast}
          settUtkast={setIntervjuUtkast}
          lagret={(s, u) => {
            if (s) setSvar(s);
            setUtfylling(u);
          }}
          ferdig={neste}
          tilbake={tilbake}
          tilbakeTekst={tilbakeTilBrev ? "Tilbake til brevet uten å endre" : "Tilbake"}
          hoppOver={hoppOver}
        />
      </>
    );
  } else {
    innhold = <VeiviserKontekst.Provider value={{ neste, tilbake, hoppOver, nesteTekst: tilbakeTilBrev ? "Lagre" : nr === steg.length - 1 ? "Se brevet" : "Neste" }}>{aktivt.innhold({ aktiv: true })}</VeiviserKontekst.Provider>;
  }

  return (
    <Ramme>
      <div className="flex flex-col gap-2">
        {!tilbakeTilBrev && (
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[#5b6472]">
              Steg {nr + 1} av {steg.length}
            </span>
            <div aria-hidden className="h-1.5 max-w-[240px] flex-1 overflow-hidden rounded-full bg-[#dcd8cf]">
              <div className="h-full rounded-full bg-[#17263d]" style={{ width: `${((nr + 1) / steg.length) * 100}%` }} />
            </div>
          </div>
        )}
        <h1 ref={overskrift} tabIndex={-1} id={`${idBase}-${aktivt.id}`} className="m-0 font-brev text-[28px] font-semibold leading-[1.2] outline-none md:text-[34px]">
          {aktivt.tittel}
        </h1>
      </div>
      <section aria-labelledby={`${idBase}-${aktivt.id}`} className="flex flex-col gap-4 rounded-lg border border-[#dcd8cf] bg-white p-5 md:p-7" key={aktivt.id}>
        {innhold}
      </section>
      {feilmelding}
      {bekreft.dialog}
    </Ramme>
  );
}
