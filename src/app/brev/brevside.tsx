"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "@/app/logo";
import { ForhandlerVelger } from "@/app/vurdering/forhandler-velger";
import { AvsenderFelt, FeilenFelt, KravFelt, OpplysningFelt, ReklamasjonFelt, VedleggFelt } from "./felt";
import { byggBrev } from "@/lib/brev/brev";
import type { Endring, Utfylling } from "@/lib/brev/utfylling";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import type { Forhandler, KlageInput } from "@/lib/vurdering/typer";
import { Brevark } from "./brevark";

const MERKE_MANGLER = "whitespace-nowrap rounded bg-[oklch(0.96_0.07_85)] px-2 py-[3px] text-[12px] font-semibold text-[#6b5618]";

// The registration number is looked up in Statens vegvesen's registry and fills in the vehicle in
// the letter. `funnet` saves it with the case and says whether that worked.
function Regnr({ kjoretoy, startRegnr, funnet, tittelId }: { kjoretoy: Kjoretoy | null; startRegnr: string; funnet: (k: Kjoretoy | null) => Promise<boolean>; tittelId: string }) {
  const id = useId();
  const [regnr, setRegnr] = useState(startRegnr);
  const [henter, setHenter] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function hent(e: FormEvent) {
    e.preventDefault();
    if (!regnr.trim() || henter) return;
    setHenter(true);
    setFeil(null);
    try {
      const res = await fetch(`/api/kjoretoy?${new URLSearchParams({ regnr })}`);
      const json = (await res.json()) as { kjoretoy?: Kjoretoy; feil?: string };
      if (!res.ok || !json.kjoretoy) throw new Error(json.feil ?? "Noe gikk galt. Prøv igjen.");
      setRegnr(json.kjoretoy.regnr);
      await funnet(json.kjoretoy);
    } catch (e) {
      setFeil(e instanceof TypeError ? "Noe gikk galt. Prøv igjen." : e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      setHenter(false);
    }
  }

  if (kjoretoy) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-kode text-[14px] tracking-[.04em] text-[#3d4757]">{kjoretoy.regnr}</span>
          <span role="status" className="text-[13px] leading-[1.4] text-[#1f5a45]">
            {[`${kjoretoy.merke} ${kjoretoy.modell}`, kjoretoy.ar, "hentet fra Statens vegvesen"].filter(Boolean).join(" · ")}
          </span>
        </div>
        <button type="button" onClick={() => funnet(null)} className="whitespace-nowrap text-[14px] font-medium text-[#5b6472]">
          Endre
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={hent} className="flex flex-col gap-2.5">
      <p id={`${id}-hjelp`} className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">
        Vi henter merke, modell og årsmodell fra Statens vegvesen og setter det inn i brevet.
      </p>
      <input
        id={id}
        aria-labelledby={tittelId}
        value={regnr}
        onChange={(e) => setRegnr(e.target.value.toUpperCase())}
        aria-describedby={`${id}-hjelp`}
        aria-invalid={feil ? true : undefined}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={10}
        placeholder="AB 12345"
        className="rounded-[6px] border-[1.5px] border-[#17263d] bg-white px-3.5 py-3 font-kode text-[17px] font-medium tracking-[.06em] placeholder:text-[#8a94a3]"
      />
      {feil && (
        <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
          {feil}
        </p>
      )}
      <button
        type="submit"
        disabled={!regnr.trim() || henter}
        className="self-start rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef] disabled:bg-[#dcd8cf] disabled:text-[#8a94a3]"
      >
        {henter ? "Henter …" : "Hent kjøretøy"}
      </button>
    </form>
  );
}

const gruppertOrgnr = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

// The dealer is found in Brreg by name or organisation number; choosing a suggestion is enough. A
// dealer missing from the register (or a sole proprietorship, which we leave out) can be used as typed.
function ForhandlerFelt({ forhandler, funnet, tittelId }: { forhandler: Forhandler | null; funnet: (f: Forhandler | null) => Promise<boolean>; tittelId: string }) {
  const [utkast, setUtkast] = useState<Forhandler>({ type: "fritekst", navn: "" });

  if (forhandler) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium">{forhandler.navn}</span>
          <span className="text-[13px] leading-[1.4] text-[#1f5a45]">
            {forhandler.type === "brreg" ? `Koblet til Enhetsregisteret · org.nr ${gruppertOrgnr(forhandler.orgnr)}` : "Ikke koblet til Enhetsregisteret"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setUtkast({ type: "fritekst", navn: forhandler.navn });
            funnet(null);
          }}
          className="whitespace-nowrap text-[14px] font-medium text-[#5b6472]"
        >
          Endre
        </button>
      </div>
    );
  }

  const navn = utkast.navn.trim();
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">Skriv navnet på forhandleren eller organisasjonsnummeret. Vi finner firmaet i Enhetsregisteret.</p>
      <div role="group" aria-labelledby={tittelId}>
        <ForhandlerVelger
          value={utkast}
          onChange={(v) => (v.type === "brreg" ? funnet(v) : setUtkast(v))}
          inputClass="w-full rounded-[6px] border-[1.5px] border-[#17263d] bg-white px-3.5 py-3 text-[16px] placeholder:text-[#8a94a3]"
          labelClass="sr-only"
          placeholder="Navn eller org.nr."
        />
      </div>
      <button
        type="button"
        disabled={navn.length < 2}
        onClick={() => funnet({ type: "fritekst", navn })}
        className="self-start rounded-[6px] border border-[#bfbab0] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#17263d] disabled:text-[#8a94a3]"
      >
        {navn.length >= 2 ? `Bruk «${navn.length > 24 ? `${navn.slice(0, 24)}…` : navn}» som skrevet` : "Bruk som skrevet"}
      </button>
    </div>
  );
}

type StegStatus = "aktiv" | "ferdig" | "venter";

// One numbered step of the fill-in list: the number turns into a check when the step is done, and
// only the active step is open. The active step is the first one not done, or a finished one the
// user has chosen to change (`endre`).
function Steg({ nr, tittel, tittelId, status, endre, children }: { nr: number; tittel: string; tittelId: string; status: StegStatus; endre?: () => void; children: ReactNode }) {
  return (
    <li aria-current={status === "aktiv" ? "step" : undefined} className={`flex gap-3.5 px-[18px] py-4 first:rounded-t-lg last:rounded-b-lg ${status === "aktiv" ? "bg-[#fbf9f4]" : ""} ${status === "venter" ? "opacity-60" : ""}`}>
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
            <button type="button" onClick={endre} className="whitespace-nowrap text-[14px] font-medium text-[#5b6472]">
              Endre
            </button>
          )}
        </div>
        {status !== "venter" && children}
      </div>
    </li>
  );
}

// Deleting is final, so it takes two clicks.
function SlettSak({ slett }: { slett: () => Promise<void> }) {
  const [spor, setSpor] = useState(false);
  const [sletter, setSletter] = useState(false);
  if (!spor) {
    return (
      <button type="button" onClick={() => setSpor(true)} className="self-start text-[13px] text-[#5b6472] underline underline-offset-2">
        Slett saken
      </button>
    );
  }
  return (
    <div role="group" aria-label="Slett saken" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] leading-[1.5] text-[#3d4757]">
      <span>Brevet og alt du har fylt inn blir slettet for godt.</span>
      <button
        type="button"
        disabled={sletter}
        onClick={async () => {
          setSletter(true);
          await slett();
          setSletter(false);
        }}
        className="font-semibold text-[#a23b2a]"
      >
        {sletter ? "Sletter …" : "Ja, slett"}
      </button>
      <button type="button" onClick={() => setSpor(false)} className="font-medium text-[#5b6472]">
        Avbryt
      </button>
    </div>
  );
}

export function BrevSide({
  id,
  input,
  idag,
  tilbakeHref,
  startUtfylling,
}: {
  id: string;
  input: KlageInput;
  // From the server, so the date in the letter is the same on both sides of hydration.
  idag: string;
  tilbakeHref: string;
  startUtfylling: Utfylling;
}) {
  const [utfylling, setUtfylling] = useState(startUtfylling);
  const [feil, setFeil] = useState<string | null>(null);
  const router = useRouter();
  const idBase = useId();
  // A finished step the user is changing. It is the open step until it is saved or cancelled.
  const [redigerer, setRedigerer] = useState<string | null>(null);
  const kjoretoy = utfylling.kjoretoy ?? null;
  const forhandler = utfylling.forhandler ?? null;

  // Saves one or more fields with the case. The letter shows what the server stored.
  async function lagre(endring: Endring): Promise<boolean> {
    setFeil(null);
    try {
      const res = await fetch(`/api/sak/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(endring) });
      const json = (await res.json()) as { utfylling?: Utfylling; feil?: string };
      if (!res.ok || !json.utfylling) throw new Error(json.feil ?? "");
      setUtfylling(json.utfylling);
      return true;
    } catch (e) {
      setFeil((e instanceof Error && !(e instanceof TypeError) && e.message) || "Vi fikk ikke lagret. Prøv igjen om litt.");
      return false;
    }
  }

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

  // The steps in order. A step is left out when the answers from the assessment make it irrelevant.
  // The first two are lookups and handle their own «Endre» (it clears the value); the rest keep
  // their value while it is being changed.
  const felles = (stegId: string) => ({
    aktiv: erAktiv(stegId),
    lagre: async (e: Endring) => {
      const ok = await lagre(e);
      if (ok) setRedigerer(null);
      return ok;
    },
    avbryt: redigerer === stegId ? () => setRedigerer(null) : undefined,
  });
  const kontakt = input.feilen.kontakt;
  const kanVelgeKrav = kontakt === "avvist" || kontakt === "forsokt";
  const steg: { id: string; tittel: string; ferdig: boolean; kanEndres?: boolean; innhold: () => ReactNode }[] = [
    {
      id: "regnr",
      tittel: "Registreringsnummer",
      ferdig: kjoretoy !== null,
      innhold: () => <Regnr kjoretoy={kjoretoy} startRegnr={startUtfylling.kjoretoy?.regnr ?? ""} funnet={(k) => lagre({ kjoretoy: k })} tittelId={`${idBase}-regnr`} />,
    },
    {
      id: "forhandler",
      tittel: "Forhandler",
      ferdig: forhandler !== null,
      innhold: () => <ForhandlerFelt forhandler={forhandler} funnet={(f) => lagre({ forhandler: f })} tittelId={`${idBase}-forhandler`} />,
    },
    {
      id: "feilen",
      tittel: "Feilen",
      ferdig: utfylling.feilen !== undefined,
      kanEndres: true,
      innhold: () => <FeilenFelt sakId={id} input={input} idag={idag} verdi={utfylling.feilen} {...felles("feilen")} />,
    },
    ...(input.feilen.feilOpplysning !== "nei"
      ? [
          {
            id: "opplysning",
            tittel: "Opplysninger før kjøpet",
            ferdig: utfylling.opplysning !== undefined,
            kanEndres: true,
            innhold: () => <OpplysningFelt verdi={utfylling.opplysning} {...felles("opplysning")} />,
          },
        ]
      : []),
    ...(kontakt !== "nei"
      ? [
          {
            id: "reklamasjon",
            tittel: "Kontakt med forhandleren",
            ferdig: utfylling.reklamasjon !== undefined && (kontakt !== "forsokt" || utfylling.reklamasjon.forsok !== undefined),
            kanEndres: true,
            innhold: () => <ReklamasjonFelt input={input} idag={idag} verdi={utfylling.reklamasjon} {...felles("reklamasjon")} />,
          },
        ]
      : []),
    {
      id: "krav",
      tittel: "Kravet",
      ferdig: utfylling.krav !== undefined && (!kanVelgeKrav || utfylling.krav.type !== undefined),
      kanEndres: true,
      innhold: () => <KravFelt input={input} verdi={utfylling.krav} {...felles("krav")} />,
    },
    {
      id: "vedlegg",
      tittel: "Vedlegg",
      ferdig: utfylling.vedlegg !== undefined,
      kanEndres: true,
      innhold: () => <VedleggFelt input={input} utfylling={utfylling} {...felles("vedlegg")} />,
    },
    {
      id: "avsender",
      tittel: "Deg",
      ferdig: utfylling.avsender !== undefined,
      kanEndres: true,
      innhold: () => <AvsenderFelt verdi={utfylling.avsender} {...felles("avsender")} />,
    },
  ];

  const aktivId = redigerer ?? steg.find((s) => !s.ferdig)?.id ?? null;
  function erAktiv(stegId: string) {
    return aktivId === stegId;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#e9e6df] font-ui text-[#17263d]">
      <div className="flex items-center justify-between border-b border-[#d3cec3] bg-[#f6f4ef] px-6 pb-[18px] pt-[52px] md:px-16 md:py-[22px]">
        <Logo liten />
        <Link href={tilbakeHref} className="text-[14px] text-[#5b6472]">
          ← Tilbake til vurderingen
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-6 px-4 pb-12 pt-6 md:px-16 md:pb-[72px] md:pt-12 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="mangler-tittel" className="flex w-full max-w-[820px] flex-col gap-4 lg:sticky lg:top-6">
          <h2 id="mangler-tittel" className="m-0 font-brev text-[22px] font-semibold leading-[1.3]">
            Fyll inn det som mangler
          </h2>
          <ol className="m-0 list-none divide-y divide-[#eceae4] rounded-lg border border-[#dcd8cf] bg-white p-0">
            {steg.map((s, n) => (
              <Steg
                key={s.id}
                nr={n + 1}
                tittel={s.tittel}
                tittelId={`${idBase}-${s.id}`}
                status={s.id === aktivId ? "aktiv" : s.ferdig ? "ferdig" : "venter"}
                endre={s.kanEndres && s.ferdig ? () => setRedigerer(s.id) : undefined}
              >
                {s.innhold()}
              </Steg>
            ))}
          </ol>
          {feil && (
            <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
              {feil}
            </p>
          )}
          <p className="m-0 text-[13px] leading-[1.55] text-[#5b6472]">
            Gule felt i brevet viser hva som mangler. Det du fyller inn lagres automatisk, og saken slettes 30 dager etter siste endring.
          </p>
          <SlettSak slett={slett} />
        </section>
        <Brevark brev={byggBrev(input, idag, utfylling)} />
      </div>
    </div>
  );
}
