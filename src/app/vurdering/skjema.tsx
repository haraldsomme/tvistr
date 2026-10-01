"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { FEILTYPER_KNAPPER, OPPLYST_VALG, stegGyldig, TOM_INNSENDING, type Innsending } from "@/lib/vurdering/innsending";
import type { KravPerOnske } from "@/lib/vurdering/krav";
import type { Tiltak } from "@/lib/vurdering/tiltak";
import { KONTAKT_VALG, ONSKER, type Kontakt, type Niva, type Onske } from "@/lib/vurdering/typer";

type Steg = 1 | 2 | 3;
type Resultat = { niva: Niva; begrunnelse: string; tiltak: Tiltak[]; krav: KravPerOnske | null };

const FEILTYPE_TEKST: Record<(typeof FEILTYPER_KNAPPER)[number], string> = {
  motor: "Motor",
  girkasse: "Girkasse",
  elektrisk: "Elektrisk",
  rust: "Rust",
  bremser: "Bremser",
  annet: "Annet",
};
const OPPLYST_TEKST = { ja: "Ja", nei: "Nei", usikker: "Usikker" } as const;
const KONTAKT_TEKST: Record<Kontakt, string> = {
  nei: "Nei, ikke ennå",
  venter: "Ja, og jeg venter på svar",
  avvist: "Ja, men forhandleren avviste",
  forsokt: "Ja, de forsøkte å rette feilen uten at det hjalp",
};
const ONSKE_TEKST: Record<Onske, string> = {
  reparasjon: "Få feilen reparert",
  pengene_tilbake_beholde: "Beholde bilen og få penger tilbake",
  levere_tilbake: "Levere bilen tilbake",
};
const NESTE_TEKST: Record<Steg, string> = { 1: "Neste: Feilen", 2: "Neste: Bevis", 3: "Se vurderingen" };

const INPUT =
  "w-full rounded-[6px] border border-[#bfbab0] bg-white p-[14px] font-ui text-[16px] text-[#17263d] outline-none placeholder:text-[#8a94a3] focus:border-[#17263d] focus:shadow-[0_0_0_.5px_#17263d]";
const LABEL = "font-ui text-[14px] font-semibold text-[#17263d]";
const KNAPP =
  "w-full rounded-[6px] bg-[#17263d] p-[18px] text-center font-ui text-[16px] font-semibold text-[#f6f4ef] disabled:cursor-not-allowed disabled:opacity-40";
const VALG = (valgt: boolean) =>
  `rounded-[6px] bg-white font-ui text-[15px] ${valgt ? "border-2 border-[#17263d] font-semibold" : "border border-[#bfbab0] font-medium"}`;

const gruppert = (siffer: string) => siffer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const bareSiffer = (s: string) => s.replace(/\D/g, "").slice(0, 9);

function Felt({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StegTopp({ steg, tilbake }: { steg: Steg; tilbake: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-6 pt-[52px]">
      <div className="flex justify-between font-ui text-[14px] text-[#5b6472]">
        {tilbake}
        <span>Steg {steg} av 3</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-[3px] flex-1 rounded-sm ${n <= steg ? "bg-[#17263d]" : "bg-[#dcd8cf]"}`} />
        ))}
      </div>
    </div>
  );
}

function Tittel({ etikett, tittel, tekst }: { etikett: string; tittel: string; tekst?: string }) {
  return (
    <div className="flex flex-col gap-2 px-6 pt-7">
      <div className="font-ui text-[13px] font-medium text-[#1f3a5f]">{etikett}</div>
      <h2 className="m-0 font-brev text-[28px] font-semibold leading-[1.15]">{tittel}</h2>
      {tekst && <p className="m-0 font-ui text-[14px] leading-[1.55] text-[#5b6472]">{tekst}</p>}
    </div>
  );
}

// Radio group built from buttons, styled like the sketches. `kolonner` 0 stacks the options.
function Valg<T extends string>({
  id,
  label,
  verdier,
  tekst,
  valgt,
  velg,
  kolonner,
}: {
  id: string;
  label: string;
  verdier: readonly T[];
  tekst: Record<T, string>;
  valgt: T | "";
  velg: (v: T) => void;
  kolonner: 0 | 2 | 3;
}) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex flex-col gap-[9px]">
      <span id={id} className={LABEL}>
        {label}
      </span>
      <div className={kolonner === 0 ? "flex flex-col gap-2" : `grid gap-2 ${kolonner === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {verdier.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={valgt === v}
            onClick={() => velg(v)}
            className={`${VALG(valgt === v)} ${kolonner === 0 ? "px-4 py-3 text-left" : "py-3 text-center"}`}
          >
            {tekst[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Avkrysning({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#dcd8cf] bg-white px-4 py-[15px]">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden
          className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[4px] font-ui text-[13px] font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-[#1f3a5f] peer-focus-visible:ring-offset-2 ${
            checked ? "bg-[#17263d] text-[#f6f4ef]" : "box-border border-[1.5px] border-[#8a94a3]"
          }`}
        >
          {checked && "✓"}
        </span>
        <span className="font-ui text-[15px] font-medium text-[#17263d]">{label}</span>
      </label>
      {checked && children}
    </div>
  );
}

const NIVA_VISNING: Record<Niva, { tekst: string; prikk: string; farge: string }> = {
  sterk: { tekst: "Sterk sak", prikk: "oklch(0.52 0.1 160)", farge: "oklch(0.42 0.1 160)" },
  middels: { tekst: "Middels sterk sak", prikk: "oklch(0.55 0.1 75)", farge: "oklch(0.45 0.1 75)" },
  svak: { tekst: "Svak sak", prikk: "oklch(0.52 0.12 25)", farge: "oklch(0.42 0.12 25)" },
  ikke_aktuell: { tekst: "Ikke aktuell", prikk: "#8a94a3", farge: "#5b6472" },
};

function Logo({ liten }: { liten?: boolean }) {
  return (
    <div className={`font-brev font-semibold leading-none ${liten ? "text-[21px] md:text-[24px]" : "text-[24px]"}`}>
      Tvistr<span className="font-normal text-[#8a94a3]">.no</span>
    </div>
  );
}

// Indeterminate on purpose: we cannot know how long the assessment takes.
function Venter() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef] font-ui text-[#17263d]">
      <div className="border-b border-[#dcd8cf] px-6 pb-[18px] pt-[52px] md:px-16 md:py-[22px]">
        <Logo liten />
      </div>
      <div role="status" className="mx-auto flex w-full max-w-[560px] flex-col gap-7 px-6 pt-14 md:px-0 md:pt-28">
        <div className="flex flex-col gap-3.5">
          <div className="text-[13px] font-medium text-[#1f3a5f]">Et øyeblikk</div>
          <h1 className="m-0 font-brev text-[30px] font-semibold leading-[1.15] md:text-[40px] md:tracking-[-.01em] md:[text-wrap:balance]">
            Vi sjekker saken din opp mot lignende saker
          </h1>
          <p className="m-0 text-[15px] leading-[1.6] text-[#3d4757] md:text-[16px]">
            Dette tar vanligvis under et halvt minutt.<span className="hidden md:inline"> Ikke lukk siden.</span>
          </p>
        </div>
        <div aria-label="Vurderer saken" role="progressbar" className="h-1 overflow-hidden rounded-sm bg-[#e6e2d8]">
          <div className="h-full w-[30%] rounded-sm bg-[#17263d] motion-safe:animate-[rull_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
      <div className="mt-auto p-6 text-center text-[13px] leading-[1.5] text-[#5b6472] md:hidden">Ikke lukk siden</div>
    </div>
  );
}

function Vurdering({ resultat, endre }: { resultat: Resultat; endre: (steg?: Steg) => void }) {
  const id = useId();
  const [onske, setOnske] = useState<Onske | "">("");
  const v = NIVA_VISNING[resultat.niva];
  const krav = resultat.krav ? resultat.krav[onske || "standard"] : [];
  return (
    <div className="min-h-screen bg-[#f6f4ef] font-ui text-[#17263d]">
      <div className="hidden border-b border-[#dcd8cf] px-16 py-[22px] md:block">
        <Logo />
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 pb-16 pt-[52px] md:px-16 md:pb-20 md:pt-16">
        <button type="button" onClick={() => endre()} className="self-start text-[14px] text-[#5b6472]">
          ← Endre svar
        </button>
        <div className="flex max-w-[620px] flex-col gap-4">
          <div className="flex items-center gap-2 md:gap-2.5">
            <div className="h-[9px] w-[9px] rounded-full md:h-2.5 md:w-2.5" style={{ background: v.prikk }} />
            <div className="text-[13px] font-semibold md:text-[14px]" style={{ color: v.farge }}>
              {v.tekst}
            </div>
          </div>
          <p className="m-0 text-[17px] leading-[1.65] text-[#3d4757] [text-wrap:pretty]">{resultat.begrunnelse}</p>
        </div>
        {krav.length > 0 && (
          <section className="flex max-w-[620px] flex-col gap-3 pt-2">
            <h2 className="m-0 font-brev text-[21px] font-semibold leading-[1.3]">Dette kan du kreve</h2>
            <Valg
              id={`${id}-onske`}
              label="Hva ønsker du helst?"
              verdier={ONSKER}
              tekst={ONSKE_TEKST}
              valgt={onske}
              velg={(o) => setOnske(o === onske ? "" : o)}
              kolonner={0}
            />
            <ul className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
              {krav.map((k) => (
                <li
                  key={k.krav}
                  className={`flex flex-col gap-1.5 rounded-lg bg-white p-5 ${k.anbefalt ? "border-2 border-[#17263d]" : "border border-[#dcd8cf]"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="font-brev text-[18px] font-semibold leading-[1.3]">{k.tittel}</div>
                    {k.anbefalt && (
                      <span className="rounded bg-[#17263d] px-2 py-0.5 text-[12px] font-semibold text-[#f6f4ef]">Anbefalt</span>
                    )}
                  </div>
                  <div className="text-[15px] font-medium leading-[1.5] text-[#1f3a5f]">{k.sjanse}</div>
                  <div className="text-[15px] leading-[1.55] text-[#3d4757]">{k.tekst}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {resultat.tiltak.length > 0 && (
          <section className="flex max-w-[620px] flex-col pt-4">
            <h2 className="m-0 pb-3 font-brev text-[21px] font-semibold leading-[1.3]">
              Hva kan du gjøre for å ha bedre muligheter for medhold:
            </h2>
            <ul className="m-0 list-none border-b border-[#dcd8cf] p-0">
              {resultat.tiltak.map((t) => (
                <li key={t.tittel} className="flex flex-col gap-1 border-t border-[#dcd8cf] py-[18px]">
                  <div className="text-[16px] font-semibold">{t.tittel}</div>
                  <div className="text-[15px] leading-[1.55] text-[#3d4757]">{t.tekst}</div>
                  {t.steg && (
                    <button type="button" onClick={() => endre(t.steg)} className="mt-2 self-start text-[15px] font-medium text-[#1f3a5f] underline underline-offset-2">
                      Gå tilbake og beskriv feilen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export function Skjema() {
  const id = useId();
  const [steg, setSteg] = useState<Steg>(1);
  const [d, setD] = useState<Innsending>(TOM_INNSENDING);
  const [sender, setSender] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const idag = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time

  const sett = <K extends keyof Innsending>(k: K, v: Innsending[K]) => setD((x) => ({ ...x, [k]: v }));
  const settBevis = (k: keyof Innsending["bevis"], v: boolean) => setD((x) => ({ ...x, bevis: { ...x.bevis, [k]: v } }));

  async function neste() {
    if (!stegGyldig(d, steg)) return;
    setFeil(null);
    if (steg < 3) return setSteg((steg + 1) as Steg);
    setSender(true);
    try {
      const res = await fetch("/api/vurder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const json = (await res.json()) as Partial<Resultat> & { feil?: string };
      if (!res.ok || !json.niva || !json.begrunnelse) throw new Error(json.feil ?? "Noe gikk galt.");
      setResultat({ niva: json.niva, begrunnelse: json.begrunnelse, tiltak: json.tiltak ?? [], krav: json.krav ?? null });
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt.");
    } finally {
      setSender(false);
    }
  }

  if (sender) return <Venter />;

  if (resultat) {
    return (
      <Vurdering
        resultat={resultat}
        endre={(s) => {
          setResultat(null);
          if (s) setSteg(s);
        }}
      />
    );
  }

  const tilbake =
    steg === 1 ? (
      <Link href="/">← Tilbake</Link>
    ) : (
      <button type="button" onClick={() => setSteg((steg - 1) as Steg)}>
        ← Tilbake
      </button>
    );

  return (
    <div className="bg-[#f6f4ef]">
      <form
        className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col font-ui text-[#17263d]"
        onSubmit={(e) => {
          e.preventDefault();
          void neste();
        }}
        noValidate
      >
        <StegTopp steg={steg} tilbake={tilbake} />

        {steg === 1 && (
          <>
            <Tittel
              etikett="Kjøpet"
              tittel="Når kjøpte du bilen?"
              tekst="Registreringsnummer og forhandler fyller du inn senere, når brevet skal lages."
            />
            <div className="grid grid-cols-2 gap-3 px-6 pt-6">
              <Felt label="Kjøpsdato" htmlFor={`${id}-kjopsdato`}>
                <input
                  id={`${id}-kjopsdato`}
                  type="date"
                  className={INPUT}
                  value={d.kjopsdato}
                  max={idag}
                  onChange={(e) => sett("kjopsdato", e.target.value)}
                />
              </Felt>
              <Felt label="Kjøpesum" htmlFor={`${id}-sum`}>
                <div className={`${INPUT} flex items-center gap-2 focus-within:border-[#17263d] focus-within:shadow-[0_0_0_.5px_#17263d]`}>
                  <input
                    id={`${id}-sum`}
                    className="min-w-0 flex-1 bg-transparent outline-none"
                    inputMode="numeric"
                    value={gruppert(d.kjopesumNok)}
                    onChange={(e) => sett("kjopesumNok", bareSiffer(e.target.value))}
                    autoComplete="off"
                  />
                  <span aria-hidden>kr</span>
                </div>
              </Felt>
            </div>
          </>
        )}

        {steg === 2 && (
          <>
            <Tittel etikett="Feilen" tittel="Hva er galt med bilen?" />
            <div className="flex flex-col gap-[18px] px-6 pt-[22px]">
              <div role="group" aria-label="Type feil" className="flex flex-wrap gap-2">
                {FEILTYPER_KNAPPER.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={d.feiltyper.includes(f)}
                    onClick={() =>
                      sett("feiltyper", d.feiltyper.includes(f) ? d.feiltyper.filter((x) => x !== f) : [...d.feiltyper, f])
                    }
                    className={`rounded-full px-3.5 py-2.5 font-ui text-[14px] font-medium ${
                      d.feiltyper.includes(f) ? "bg-[#17263d] text-[#f6f4ef]" : "border border-[#bfbab0] bg-white text-[#17263d]"
                    }`}
                  >
                    {FEILTYPE_TEKST[f]}
                  </button>
                ))}
              </div>
              <Felt label="Beskriv feilen med egne ord" htmlFor={`${id}-beskrivelse`}>
                <textarea
                  id={`${id}-beskrivelse`}
                  className={`${INPUT} h-36 resize-none text-[16px] leading-[1.55]`}
                  value={d.beskrivelse}
                  onChange={(e) => sett("beskrivelse", e.target.value.slice(0, 2000))}
                  placeholder="F.eks.: Motorlampen begynte å lyse tre uker etter kjøpet, og bilen mister kraft i motbakker. Verkstedet sier turboen er defekt og at det koster ca. 25 000 kr å skifte den."
                />
              </Felt>
              <Felt label="Når oppdaget du feilen?" htmlFor={`${id}-oppdaget`}>
                <input
                  id={`${id}-oppdaget`}
                  type="date"
                  className={INPUT}
                  value={d.oppdagetDato}
                  min={d.kjopsdato || undefined}
                  max={idag}
                  onChange={(e) => sett("oppdagetDato", e.target.value)}
                />
              </Felt>
              <Valg
                id={`${id}-opplyst`}
                label="Ble du fortalt om feilen før kjøpet?"
                verdier={OPPLYST_VALG}
                tekst={OPPLYST_TEKST}
                valgt={d.opplystForKjop}
                velg={(v) => sett("opplystForKjop", v)}
                kolonner={3}
              />
              <Valg
                id={`${id}-kontakt`}
                label="Har du kontaktet forhandleren om feilen?"
                verdier={KONTAKT_VALG}
                tekst={KONTAKT_TEKST}
                valgt={d.kontakt}
                velg={(v) => sett("kontakt", v)}
                kolonner={0}
              />
            </div>
          </>
        )}

        {steg === 3 && (
          <>
            <Tittel etikett="Bevis" tittel="Hva har du av dokumentasjon?" tekst="Kryss av for det du har." />
            <div className="flex flex-col gap-2.5 px-6 pt-5">
              <Avkrysning label="Kjøpekontrakt" checked={d.bevis.kjopekontrakt} onChange={(v) => settBevis("kjopekontrakt", v)} />
              <Avkrysning
                label="Verksted- eller tilstandsrapport"
                checked={d.bevis.verkstedrapport}
                onChange={(v) => settBevis("verkstedrapport", v)}
              >
                <div className="ml-[34px] flex flex-col gap-[18px]">
                  <Valg
                    id={`${id}-rapport`}
                    label="Sier rapporten at feilen sannsynligvis var til stede før kjøpet?"
                    verdier={["ja", "nei"] as const}
                    tekst={{ ja: "Ja", nei: "Nei" }}
                    valgt={d.rapportSierForKjop}
                    velg={(v) => sett("rapportSierForKjop", v)}
                    kolonner={2}
                  />
                  <div className="flex flex-col gap-[7px]">
                    <label htmlFor={`${id}-utbedring`} className={LABEL}>
                      Hva koster det å utbedre feilen? (valgfritt)
                    </label>
                    <div className={`${INPUT} flex items-center gap-2 focus-within:border-[#17263d] focus-within:shadow-[0_0_0_.5px_#17263d]`}>
                      <input
                        id={`${id}-utbedring`}
                        className="min-w-0 flex-1 bg-transparent outline-none"
                        inputMode="numeric"
                        placeholder="f.eks. 25 000"
                        value={gruppert(d.utbedringskostnadNok)}
                        onChange={(e) => sett("utbedringskostnadNok", bareSiffer(e.target.value))}
                        autoComplete="off"
                        aria-describedby={`${id}-utbedring-hjelp`}
                      />
                      <span aria-hidden>kr</span>
                    </div>
                    <span id={`${id}-utbedring-hjelp`} className="font-ui text-[13px] leading-[1.4] text-[#5b6472]">
                      Står i rapporten eller i et pristilbud fra verkstedet.
                    </span>
                  </div>
                </div>
              </Avkrysning>
              <Avkrysning label="Bilder eller video av feilen" checked={d.bevis.bilder} onChange={(v) => settBevis("bilder", v)} />
              <Avkrysning label="E-post eller SMS med forhandleren" checked={d.bevis.korrespondanse} onChange={(v) => settBevis("korrespondanse", v)} />
              <Avkrysning label="Annonsen bilen ble solgt med" checked={d.bevis.annonse} onChange={(v) => settBevis("annonse", v)} />
            </div>
          </>
        )}

        <div className="mt-auto flex flex-col gap-3 p-6">
          {feil && (
            <p role="alert" className="m-0 text-center font-ui text-[14px] text-[oklch(0.42_0.12_25)]">
              {feil}
            </p>
          )}
          <button type="submit" className={KNAPP} disabled={!stegGyldig(d, steg) || sender}>
            {sender ? "Vurderer saken …" : NESTE_TEKST[steg]}
          </button>
        </div>
      </form>
    </div>
  );
}
