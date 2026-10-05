"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Logo } from "@/app/logo";
import { Button } from "@/components/ui/button";
import { BekreftKnapp, useBekreftLagring } from "./bekreft";
import { KontaktFelt } from "./steg/kontakt";
import { lagSteg } from "./steg/liste";
import { byggBrev, harPlassholder, henvisningFor } from "@/lib/brev/brev";
import { motsvar } from "@/lib/brev/motsvar";
import type { Lagring, Utfylling } from "@/lib/brev/utfylling";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { tilKlageInput, type Innsending } from "@/lib/vurdering/innsending";
import { gyldigRetting } from "@/lib/vurdering/typer";
import { Brevark } from "./brevark";
import { Saksmappe } from "./mappe/saksmappe";
import { Motsvar } from "./motsvar";

const MERKE_MANGLER = "whitespace-nowrap rounded bg-[oklch(0.96_0.07_85)] px-2 py-[3px] text-[12px] font-semibold text-[#6b5618]";

type StegStatus = "aktiv" | "ferdig" | "venter";

// One numbered step of the fill-in list: the number turns into a check when the step is done, and
// only the active step is open. The active step is the first one not done, or a finished one the
// user has chosen to change (`endre`).
function Steg({ id, nr, tittel, tittelId, status, endre, children }: { id: string; nr: number; tittel: string; tittelId: string; status: StegStatus; endre?: () => void; children: ReactNode }) {
  return (
    <li id={`steg-${id}`} aria-current={status === "aktiv" ? "step" : undefined} className={`flex gap-3.5 px-[18px] py-4 first:rounded-t-lg last:rounded-b-lg ${status === "aktiv" ? "bg-[#fbf9f4]" : ""} ${status === "venter" ? "opacity-60" : ""}`}>
      {status === "ferdig" ? (
        <span role="img" aria-label="Ferdig" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[oklch(0.52_0.1_160)] text-[13px] font-semibold text-white">
          ✓
        </span>
      ) : (
        <span aria-hidden className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${status === "aktiv" ? "bg-[#17263d] text-[#f6f4ef]" : "border border-[#bfbab0] text-[#5b6472]"}`}>
          {nr}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 id={tittelId} className="m-0 text-[14px] font-semibold leading-[28px]">
            {tittel}
          </h3>
          {status === "aktiv" && !endre && <span className={MERKE_MANGLER}>Mangler</span>}
          {status === "ferdig" && endre && (
            <Button type="button" variant="ghost" size="sm" onClick={endre} className="text-[14px] font-medium">
              Endre
            </Button>
          )}
        </div>
        {status !== "venter" && children}
      </div>
    </li>
  );
}

// Deleting is final, so it asks first.
function SlettSak({ slett }: { slett: () => Promise<void> }) {
  return (
    <BekreftKnapp tittel="Slette saken?" tekst="Brevet og alt du har fylt inn blir slettet for godt. Det kan ikke angres." handling="Slett saken" destruktiv utfor={slett}>
      <Button type="button" variant="link" className="self-start text-[13px] font-normal">
        Slett saken
      </Button>
    </BekreftKnapp>
  );
}

// The page around the letter: the header, and a column for what the buyer fills in beside the letter.
function Ramme({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#e9e6df] font-ui text-[#17263d]">
      <div className="flex items-center border-b border-[#d3cec3] bg-[#f6f4ef] px-6 pb-[18px] pt-[52px] md:px-16 md:py-[22px]">
        <Logo liten />
      </div>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-6 px-4 pb-12 pt-6 md:px-16 md:pb-[72px] md:pt-12 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-10">{children}</div>
    </div>
  );
}

type Fane = "fyll" | "brev" | "motsvar" | "mappe";
const FANER: Fane[] = ["fyll", "brev", "motsvar", "mappe"];
const FANE_TEKST: Record<Fane, string> = { fyll: "Fyll inn", brev: "Brev", motsvar: "Motsvar", mappe: "Saksmappe" };

// The letter page is where the buyer lands after buying, so there is no way back to the assessment:
// the answers it gave are corrected in the step they belong to, and the vehicle is fixed from the start.
export function BrevSide({
  id,
  startSvar,
  idag,
  startUtfylling,
}: {
  id: string;
  startSvar: Innsending;
  // From the server, so the date in the letter is the same on both sides of hydration.
  idag: string;
  startUtfylling: Utfylling;
}) {
  const [svar, setSvar] = useState(startSvar);
  const [utfylling, setUtfylling] = useState(startUtfylling);
  // On a narrow screen only one of the fill-in list and the letter shows at a time (on a wide screen
  // both always do); a letter with something still missing opens on the list, a finished one on itself.
  const parsed0 = tilKlageInput(startSvar, idag);
  const alleredeFerdig = parsed0.ok && !harPlassholder(byggBrev(parsed0.input, idag, startUtfylling));
  const [fane, setFane] = useState<Fane>(alleredeFerdig ? "brev" : "fyll");
  const [feil, setFeil] = useState<string | null>(null);
  const router = useRouter();
  const idBase = useId();
  // The defect is described in the wizard, which comes back to the letter when it is saved.
  const feilenAdresse = `/brev/${id}/veiviser?steg=feilen&tilbake=brev`;
  // A finished step the user is changing. It is the open step until it is saved or cancelled.
  const [redigerer, setRedigerer] = useState<string | null>(null);
  const parsed = tilKlageInput(svar, idag);
  // The answers were valid when they were saved; a deadline that has begun to matter since can make
  // them incomplete. The buyer then corrects them before the letter can be written.
  const input = parsed.ok ? parsed.input : null;
  // A correction the law would stop is not saved (`kontrollerRettelse`), so the claim is only stopped
  // here when time has passed since: the purchase has passed five years before the dealer was told.
  const stopp = input === null ? null : beregnFaktorer(input, idag).stopp;

  // Saves one step: the fill-in fields that changed, and the answers from the assessment it corrects,
  // if any. The letter shows what the server stored, including the answers it derives from the save
  // (how long after the purchase the defect showed, and so on; see `avledSvar`).
  async function lagre(lagring: Lagring): Promise<boolean> {
    setFeil(null);
    try {
      const res = await fetch(`/api/sak/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lagring) });
      const json = (await res.json()) as { svar?: Innsending; utfylling?: Utfylling; feil?: string };
      if (!res.ok || !json.utfylling) throw new Error(json.feil ?? "");
      if (json.svar) setSvar(json.svar);
      setUtfylling(json.utfylling);
      setRedigerer(null);
      return true;
    } catch (e) {
      setFeil((e instanceof Error && !(e instanceof TypeError) && e.message) || "Vi fikk ikke lagret. Prøv igjen om litt.");
      return false;
    }
  }

  // The steps' saves ask first when they make the letter weaker. The folder's saves (the checklist, the
  // date the letter was sent) ask on their own.
  const bekreft = useBekreftLagring(lagre, { svar, utfylling }, idag);

  async function slett() {
    setFeil(null);
    try {
      const res = await fetch(`/api/sak/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      setFeil("Vi fikk ikke slettet saken. Prøv igjen om litt.");
    }
  }

  // Opens the step a clicked placeholder in the letter belongs to.
  function apneSteg(stegId: string) {
    if (stegId === "feilen") {
      router.push(feilenAdresse);
      return;
    }
    setFane("fyll");
    setRedigerer(stegId);
    requestAnimationFrame(() => document.getElementById(`steg-${stegId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  const feilmelding = feil && (
    <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
      {feil}
    </p>
  );

  const retting = gyldigRetting(svar.kontakt || "nei", utfylling.retting);

  // The answers no longer give a letter (typically: the five-year deadline has begun to matter since
  // they were saved): only the one step that decides it is shown, open, until it is corrected.
  if (!input) {
    return (
      <Ramme>
        <section aria-labelledby="mangler-tittel" className="flex w-full max-w-[820px] flex-col gap-4 lg:col-span-2">
          <h2 id="mangler-tittel" className="m-0 font-brev text-[22px] font-semibold leading-[1.3]">
            Svarene dine må rettes
          </h2>
          <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
            {!parsed.ok && parsed.feil}
          </p>
          <ol className="m-0 list-none divide-y divide-[#eceae4] rounded-lg border border-[#dcd8cf] bg-white p-0">
            <Steg id="kontakt" nr={1} tittel="Kontakt med forhandleren" tittelId={`${idBase}-kontakt`} status="aktiv">
              <KontaktFelt svar={svar} idag={idag} retting={retting} reklamasjon={utfylling.reklamasjon} aktiv lagre={lagre} />
            </Steg>
          </ol>
          {feilmelding}
          <SlettSak slett={slett} />
        </section>
      </Ramme>
    );
  }

  // The steps in order (`steg/liste.tsx`). «Forhandleren» looks up the dealer itself and handles its
  // own «Endre» (it clears the value); «Feilen» is changed in the wizard; the rest keep their value
  // while it is being changed.
  const steg = lagSteg({ sakId: id, input, svar, utfylling, idag, idBase, lagre: bekreft.lagre });
  const aktivId = redigerer ?? steg.find((s) => !s.ferdig)?.id ?? null;
  function erAktiv(stegId: string) {
    return aktivId === stegId;
  }
  const ferdigAntall = steg.filter((s) => s.ferdig).length;

  const brev = byggBrev(input, idag, utfylling);
  const henvisning = henvisningFor(input, idag, utfylling);
  const faner = (
    <div role="tablist" aria-label="Sakens deler" className="flex w-full gap-1 border-b border-[#d3cec3] lg:col-span-2">
      {FANER.map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          id={`fane-${f}`}
          aria-selected={fane === f}
          aria-controls={`panel-${f}`}
          tabIndex={fane === f ? 0 : -1}
          onClick={() => setFane(f)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const annen = FANER[(FANER.indexOf(f) + (e.key === "ArrowRight" ? 1 : FANER.length - 1)) % FANER.length];
            setFane(annen);
            document.getElementById(`fane-${annen}`)?.focus();
          }}
          className={`-mb-px border-b-2 px-4 py-3 text-[15px] font-semibold lg:last:ml-auto ${f === "fyll" ? "lg:hidden" : ""} ${fane === f ? "border-[#17263d] text-[#17263d]" : "border-transparent text-[#5b6472]"}`}
        >
          {FANE_TEKST[f]}
        </button>
      ))}
    </div>
  );
  // The numbers in the saksmappe follow the answers, the claim and the dealer; ticks do not change
  // them, so they are left out and do not make it fetch again.
  const avhengighet = JSON.stringify([svar, utfylling.krav, utfylling.forhandler, utfylling.sendt]);

  const fyllKolonne = (
    <section aria-labelledby="mangler-tittel" className={`flex w-full max-w-[820px] flex-col gap-4 ${fane === "fyll" ? "" : "hidden lg:flex"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mangler-tittel" className="m-0 font-brev text-[22px] font-semibold leading-[1.3]">
          Fyll inn det som mangler
        </h2>
        <span className="whitespace-nowrap text-[13px] text-[#5b6472]">
          {ferdigAntall} av {steg.length}
        </span>
      </div>
      <ol className="m-0 list-none divide-y divide-[#eceae4] rounded-lg border border-[#dcd8cf] bg-white p-0">
        {steg.map((s, n) => (
          <Steg
            key={s.id}
            id={s.id}
            nr={n + 1}
            tittel={s.tittel}
            tittelId={`${idBase}-${s.id}`}
            status={s.id === aktivId ? "aktiv" : s.ferdig ? "ferdig" : "venter"}
            endre={s.id !== "forhandler" && s.ferdig ? () => (s.id === "feilen" ? router.push(feilenAdresse) : setRedigerer(s.id)) : undefined}
          >
            {s.innhold({ aktiv: erAktiv(s.id), avbryt: redigerer === s.id ? () => setRedigerer(null) : undefined })}
          </Steg>
        ))}
      </ol>
      {feilmelding}
      <p className="m-0 text-[13px] leading-[1.55] text-[#5b6472]">
        Gule felt i brevet viser hva som mangler. Det du fyller inn lagres automatisk, og saken slettes 30 dager etter siste endring.
      </p>
      <SlettSak slett={slett} />
    </section>
  );

  const brevKolonne = (
    <div className={`flex w-full max-w-[820px] flex-col gap-4 lg:sticky lg:top-6 ${fane === "brev" ? "" : "hidden lg:flex"}`}>
      {stopp && (
        <p role="alert" className="m-0 rounded-lg border border-[oklch(0.72_0.11_85)] bg-[oklch(0.96_0.07_85)] px-[18px] py-3.5 text-[14px] leading-[1.55] text-[#6b5618]">
          {stopp === "frist"
            ? "Det har gått mer enn fem år siden kjøpet, og med disse svarene er fristen for å klage ute. Brevet står som det er, men forhandleren kan avvise kravet fordi det kommer for sent. Sjekk at svarene fra vurderingen stemmer."
            : "Med disse svarene gjelder ikke forbrukerkjøpsloven for kjøpet (kjøp fra en privatperson eller gjennom et firma). Brevet står som det er, men forhandleren kan avvise kravet. Sjekk at svarene fra vurderingen stemmer."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={`/api/sak/${id}/dokument/brev.pdf`} download className="rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef]">
          Last ned PDF
        </a>
        <a href={`/api/sak/${id}/dokument/brev.docx`} download className="rounded-[6px] border border-[#bfbab0] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#17263d]">
          Last ned Word
        </a>
        {harPlassholder(brev) && (
          <p role="status" className="m-0 text-[13px] leading-[1.5] text-[#6b5618]">
            Brevet har felt som mangler (markert gult). Du kan laste det ned nå og fylle ut for hånd.
          </p>
        )}
      </div>
      <Brevark brev={brev} apne={apneSteg} />
    </div>
  );

  return (
    <Ramme>
      {faner}
      {fane === "mappe" ? (
        <div role="tabpanel" id="panel-mappe" aria-labelledby="fane-mappe" className="flex w-full justify-center lg:col-span-2">
          <Saksmappe sakId={id} avhengighet={avhengighet} utfylling={utfylling} henvisning={henvisning} lagre={lagre} />
        </div>
      ) : fane === "motsvar" ? (
        <div role="tabpanel" id="panel-motsvar" aria-labelledby="fane-motsvar" className="flex w-full justify-center lg:col-span-2">
          <Motsvar motargumenter={motsvar(beregnFaktorer(input, idag), utfylling)} />
        </div>
      ) : (
        <>
          <div role="tabpanel" id={fane === "fyll" ? "panel-fyll" : "panel-brev"} aria-labelledby={fane === "fyll" ? "fane-fyll" : "fane-brev"} className="contents">
            {fyllKolonne}
            {brevKolonne}
          </div>
        </>
      )}
      {bekreft.dialog}
    </Ramme>
  );
}
