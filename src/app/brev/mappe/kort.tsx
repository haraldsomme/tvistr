"use client";

import { useId, useState, type ReactNode } from "react";
import { norskDato } from "@/lib/brev/brev";
import type { Endring, Lignende, SjekkNokkel } from "@/lib/brev/utfylling";
import type { AktorKort } from "@/lib/mappe/kort/aktorer";
import type { AvgjordeKort } from "@/lib/mappe/kort/avgjorde";
import type { BelopKort } from "@/lib/mappe/kort/belop";
import type { StyrkeKort } from "@/lib/mappe/kort/styrke";
import type { Sjekkpunkt } from "@/lib/mappe/kort/styrk";
import type { VidereKort } from "@/lib/mappe/kort/videre";
import { erForFa, type Andel, type ForFa } from "@/lib/mappe/typer";

// The cards of the saksmappe. Every share is shown with the number of decisions behind it; a sample
// below its threshold is shown as «for få saker», never as a number.

const pct = (x: number) => Math.round(x * 100);
const kr = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
const SMA = "m-0 text-[13px] leading-[1.55] text-[#5b6472]";
const KNAPP_LITEN = "rounded-[6px] border border-[#bfbab0] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#17263d] disabled:text-[#8a94a3]";

export function Kort({ tittel, children }: { tittel: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-lg border border-[#dcd8cf] bg-white p-5 md:p-7">
      <h3 id={id} className="m-0 mb-3 font-brev text-[19px] font-semibold leading-[1.3]">
        {tittel}
      </h3>
      <div className="flex flex-col gap-3 text-[14px] leading-[1.6] text-[#3d4757]">{children}</div>
    </section>
  );
}

function ForFaSaker({ a, hva }: { a: ForFa; hva: string }) {
  return (
    <p className="m-0">
      {hva}: for få saker ({a.n}) til å si noe sikkert.
    </p>
  );
}

function Prosent({ a, hva }: { a: Andel | ForFa; hva: string }) {
  if (erForFa(a)) return <ForFaSaker a={a} hva={hva} />;
  return (
    <p className="m-0">
      {hva}: <strong>{pct(a.andel)} %</strong> ({a.n} saker, 95 % intervall {pct(a.lav)}–{pct(a.hoy)} %).
    </p>
  );
}

function Fordeling({ f }: { f: { fullt: number; delvis: number; avslag: number } }) {
  const tot = f.fullt + f.delvis + f.avslag;
  if (tot === 0) return null;
  const deler = [
    { n: f.fullt, tekst: "Fullt medhold", farge: "bg-[#2f6b52]" },
    { n: f.delvis, tekst: "Delvis medhold", farge: "bg-[#8fb8a3]" },
    { n: f.avslag, tekst: "Ikke medhold", farge: "bg-[#c9c3b6]" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={deler.map((d) => `${d.tekst} ${pct(d.n / tot)} prosent`).join(", ")} className="flex h-3 w-full overflow-hidden rounded-full">
        {deler.map((d) => (
          <div key={d.tekst} style={{ width: `${(d.n / tot) * 100}%` }} className={d.farge} />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[13px]">
        {deler.map((d) => (
          <li key={d.tekst}>
            {d.tekst}: <strong>{pct(d.n / tot)} %</strong> ({d.n})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StyrkeInnhold({ k }: { k: StyrkeKort }) {
  const utvalg = k.spesifikk ? `Utvalget: saker med ${k.beskrivelse.replace(/_/g, " ")}.` : "Vi fant ikke nok saker med samme feil, så tallet gjelder alle forhandlersaker.";
  if (erForFa(k.medhold)) {
    return (
      <>
        <p className="m-0">Vi har for få saker som ligner din ({k.medhold.n}) til å si noe sikkert om sjansene dine.</p>
        <p className={SMA}>Tall på sjanse gjelder bare saker som gikk til vedtak. Saker som ble avgjort uten vedtak er ikke med.</p>
      </>
    );
  }
  const m = k.medhold;
  return (
    <>
      <p className="m-0 text-[16px]">
        <strong className="text-[26px] text-[#17263d]">{pct(m.andel)} %</strong> fikk medhold eller delvis medhold i {m.n} lignende saker (95 % intervall {pct(m.lav)}–{pct(m.hoy)} %).
      </p>
      <Fordeling f={k.fordeling} />
      <p className={SMA}>{utvalg}</p>
      <p className={SMA}>
        Sjansen er gitt at saken gikk til vedtak: saker som ble avgjort uten vedtak er ikke med. Feilene du krysset av er feil klageren påberopte i vedtakene, ikke nødvendigvis de utvalget godtok.
      </p>
    </>
  );
}

export function BelopInnhold({ k }: { k: BelopKort }) {
  const tomt = !k.tilkjent && !k.prisavslag && !k.heving && !k.erstatning;
  return (
    <>
      {tomt && <p className="m-0">For få lignende saker med oppgitte beløp til å si hva du kan få.</p>}
      {k.tilkjent && (
        <p className="m-0">
          Når noe ble tilkjent, var det typisk <strong>{kr(k.tilkjent.median)}</strong> (midtre halvdel {kr(k.tilkjent.p25)}–{kr(k.tilkjent.p75)}, {k.tilkjent.n} saker).
        </p>
      )}
      {k.prisavslag && (
        <p className="m-0">
          Med en utbedringskostnad på {kr(k.prisavslag.utbedringNok)} ga tilsvarende saker typisk et prisavslag på <strong>{kr(k.prisavslag.median)}</strong> (midtre halvdel {kr(k.prisavslag.fra)}–{kr(k.prisavslag.til)}, {k.prisavslag.n} saker).
        </p>
      )}
      {k.heving && (
        <p className="m-0">
          Ble heving krevd som hovedkrav ({k.heving.n} saker), fikk {pct(k.heving.fullt / k.heving.n)} % full heving, {pct(k.heving.delvis / k.heving.n)} % delvis medhold og {pct(k.heving.ikke / k.heving.n)} % ikke medhold.
        </p>
      )}
      {k.erstatning && (
        <p className="m-0">
          Erstatning for utgifter ble krevd i {k.erstatning.n} saker, og tilkjent helt eller delvis i {pct(k.erstatning.andelTilkjent)} %{k.erstatning.median !== null ? `, typisk ${kr(k.erstatning.median)}` : ""}.
        </p>
      )}
      {k.anbefaling.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md bg-[#f6f4ef] p-3.5">
          <strong className="text-[13px] uppercase tracking-[.04em] text-[#5b6472]">Slik bør kravet settes opp</strong>
          {k.anbefaling.map((a) => (
            <p key={a} className="m-0">
              {a}
            </p>
          ))}
        </div>
      )}
      <p className={SMA}>Beløpene er det utvalget tilkjente, uten renter, og sier ikke hva du får i din sak.</p>
    </>
  );
}

const UTFALL: Record<string, string> = { medhold: "Medhold", delvis_medhold: "Delvis medhold", ikke_medhold: "Tapt sak" };

export function AvgjordeInnhold({ k, valgt, lagre }: { k: AvgjordeKort; valgt: Lignende[]; lagre: (e: Endring) => Promise<boolean> }) {
  const [feil, setFeil] = useState<string | null>(null);
  async function sett(neste: Lignende[]) {
    setFeil(null);
    if (!(await lagre({ lignende: neste }))) setFeil("Vi fikk ikke lagret valget. Prøv igjen.");
  }
  return (
    <>
      {k.temaer.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <strong className="text-[13px] uppercase tracking-[.04em] text-[#5b6472]">Hva som kom opp i vunne og tapte saker</strong>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {k.temaer.map((t) => (
              <li key={t.tekst}>
                <strong>{t.tekst}</strong> kommer opp i {pct(t.andelAvslag)} % av tapte saker mot {pct(t.andelMedhold)} % av vunne.
              </li>
            ))}
          </ul>
        </div>
      )}
      {k.eksempler.length === 0 ? (
        <p className="m-0">Vi har ingen kontrollerte eksempelvedtak som passer saken din.</p>
      ) : (
        <p className={SMA}>Et vedtak kan også ha punkter som gikk mot klageren. Siter bare punkter som støtter kravet ditt.</p>
      )}
      {k.eksempler.length > 0 && (
        <ul aria-label="Eksempelvedtak" className="m-0 flex list-none flex-col gap-3 p-0">
          {k.eksempler.map((e) => {
            const tapt = e.utfall === "ikke_medhold";
            const valgtMoment = valgt.find((v) => v.id === e.id)?.moment;
            return (
              <li key={e.id} className="flex flex-col gap-2 rounded-md border border-[#e4e0d6] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {e.ar} · {UTFALL[e.utfall]}
                    {e.tilkjentNok ? ` · ${kr(e.tilkjentNok)}` : ""}
                  </strong>
                  <a href={e.kildeUrl} target="_blank" rel="noreferrer" className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">
                    Forbrukerklageutvalget, sak {e.saksnummer}
                  </a>
                </div>
                {e.sammendrag && <p className="m-0">{e.sammendrag}</p>}
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {e.momenter.map((m, n) => (
                    <li key={n} className="flex items-start justify-between gap-3">
                      <span>– {m}</span>
                      {!tapt &&
                        (valgtMoment === n ? (
                          <button type="button" onClick={() => sett(valgt.filter((v) => v.id !== e.id))} className={`${KNAPP_LITEN} whitespace-nowrap`}>
                            Fjern fra brevet
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={valgtMoment === undefined && valgt.length >= 3}
                            onClick={() => sett([...valgt.filter((v) => v.id !== e.id), { id: e.id, moment: n }])}
                            className={`${KNAPP_LITEN} whitespace-nowrap`}
                          >
                            Siter i brevet
                          </button>
                        ))}
                    </li>
                  ))}
                </ul>
                <p className={SMA}>Nøkkelpunktene er et sammendrag laget av en modell. Les vedtaket før du bruker det.</p>
              </li>
            );
          })}
        </ul>
      )}
      {feil && (
        <p role="alert" className="m-0 text-[13px] text-[#a23b2a]">
          {feil}
        </p>
      )}
    </>
  );
}

export function AktorInnhold({ k }: { k: AktorKort }) {
  return (
    <>
      {k.forhandler ? (
        <div className="flex flex-col gap-1">
          <strong>Forhandleren</strong>
          <Prosent a={k.forhandler.medhold} hva={`Medhold i tidligere vedtak (${k.forhandler.n} totalt)`} />
          {k.forhandler.sisteAr && <p className="m-0">Siste vedtak: {k.forhandler.sisteAr}.</p>}
          {k.forhandler.feiltyper.length > 0 && <p className="m-0">Vanligste feil: {k.forhandler.feiltyper.join(", ")}.</p>}
          {k.forhandler.gammel && <p className={SMA}>Historikken er fra før 2024 og kan være utdatert.</p>}
        </div>
      ) : (
        <p className="m-0">Vi har ingen tidligere vedtak om denne forhandleren.</p>
      )}
      {k.modell ? (
        <div className="flex flex-col gap-1">
          <strong>Bilmodellen</strong>
          <Prosent a={k.modell.medhold} hva={`Medhold i saker om samme modell`} />
        </div>
      ) : (
        <p className="m-0">Vi har ingen tidligere vedtak om denne modellen.</p>
      )}
    </>
  );
}

export function StyrkInnhold({ punkter, sjekket, lagre }: { punkter: Sjekkpunkt[]; sjekket: SjekkNokkel[]; lagre: (e: Endring) => Promise<boolean> }) {
  // The tick shows at once and is rolled back if the save fails.
  const [lokal, setLokal] = useState(sjekket);
  async function bytt(nokkel: SjekkNokkel) {
    const neste = lokal.includes(nokkel) ? lokal.filter((x) => x !== nokkel) : [...lokal, nokkel];
    const for_ = lokal;
    setLokal(neste);
    if (!(await lagre({ sjekket: neste }))) setLokal(for_);
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {punkter.map((p) => {
        const id = `sjekk-${p.nokkel}`;
        return (
          <li key={p.nokkel} className="flex flex-col gap-1">
            <label htmlFor={id} className="flex items-start gap-2.5 font-semibold">
              <input id={id} type="checkbox" checked={lokal.includes(p.nokkel)} onChange={() => bytt(p.nokkel)} className="mt-1" />
              {p.tittel}
            </label>
            <p className="m-0 pl-[26px]">{p.tekst}</p>
            {p.andel && !erForFa(p.andel) && (
              <p className={`${SMA} pl-[26px]`}>
                {pct(p.andel.andel)} % av vunne saker hadde dette ({p.andel.n} saker).
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function VidereInnhold({ k, sakId, sendt, idag, lagre }: { k: VidereKort; sakId: string; sendt: string | undefined; idag: string; lagre: (e: Endring) => Promise<boolean> }) {
  const id = useId();
  const [dato, setDato] = useState(sendt ?? "");
  const [kopiert, setKopiert] = useState<string | null>(null);
  async function kopier(nokkel: string, tekst: string) {
    try {
      await navigator.clipboard.writeText(tekst);
      setKopiert(nokkel);
    } catch {
      setKopiert(null);
    }
  }
  return (
    <>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {k.steg.map((s) => (
          <li key={s.tittel}>
            <strong>{s.tittel}</strong>
            {s.dato && <span className="text-[#5b6472]"> · {norskDato(s.dato)}</span>}
            <p className="m-0">{s.tekst}</p>
          </li>
        ))}
      </ol>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dato) void lagre({ sendt: dato });
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-[13px] font-semibold">
            Dato brevet ble sendt
          </label>
          <input id={id} type="date" max={idag} value={dato} onChange={(e) => setDato(e.target.value)} className="rounded-[6px] border border-[#bfbab0] bg-white px-3 py-2 text-[15px]" />
        </div>
        <button type="submit" disabled={!dato} className={KNAPP_LITEN}>
          Lagre dato
        </button>
        {sendt && (
          <button
            type="button"
            onClick={() => {
              setDato("");
              void lagre({ sendt: null });
            }}
            className={KNAPP_LITEN}
          >
            Fjern datoen
          </button>
        )}
      </form>
      {sendt && (
        <div className="flex flex-wrap items-center gap-3">
          <strong>Purring til forhandleren</strong>
          <a href={`/api/sak/${sakId}/dokument/purring.pdf`} download className={KNAPP_LITEN}>
            Last ned purring (PDF)
          </a>
          <a href={`/api/sak/${sakId}/dokument/purring.docx`} download className={KNAPP_LITEN}>
            Last ned purring (Word)
          </a>
        </div>
      )}
      <p className={SMA}>{k.ventetid}</p>
      <div className="flex flex-col gap-2">
        <strong className="text-[13px] uppercase tracking-[.04em] text-[#5b6472]">Hvis forhandleren svarer</strong>
        {k.motargumenter.map((m) => (
          <details key={m.nokkel} open={m.relevant} className="rounded-md border border-[#e4e0d6] p-3">
            <summary className="cursor-pointer font-semibold">
              {m.tittel}
              {m.relevant && <span className="ml-2 text-[12px] font-normal text-[#6b5618]">passer saken din</span>}
            </summary>
            <p className="mb-2 mt-2">{m.svar}</p>
            <button type="button" onClick={() => kopier(m.nokkel, m.svar)} className={KNAPP_LITEN}>
              {kopiert === m.nokkel ? "Kopiert" : "Kopier svar"}
            </button>
          </details>
        ))}
      </div>
    </>
  );
}
