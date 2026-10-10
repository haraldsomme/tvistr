"use client";

import { CalendarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { nb } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import { HVOR_STO_DET, KATEGORIER, MAKS_FEIL, RAPPORT_TOM, SKJEMA_VERSJON, validerSkjema, type Skjema, type SkjemaFeil } from "@/lib/skjema/skjema";
import { type FeilSvar, type PraksisUt, type SakSvar, sendSak, skrivPraksisFor } from "./actions";
import { Forhandlervelger } from "./forhandler";

type Valgliste<T extends string> = readonly (readonly [T, string])[];
type Kontakt = Skjema["del6_kontakt_med_selger"];

const JA_NEI: Valgliste<"ja" | "nei"> = [
  ["ja", "Ja"],
  ["nei", "Nei"],
];
const RAPPORTSVAR: Valgliste<"ja" | "nei" | "star_ikke"> = [...JA_NEI, ["star_ikke", "Står ikke"]];
// Spec 16a–16d (docs/skjema.md).
const RAPPORT_SPORSMAL = [
  ["hva", "Står det hvilken del som er feil?"],
  ["hvorfor", "Står det hvorfor den sviktet (årsak)?"],
  ["var_der_ved_overtakelse", "Står det at feilen sannsynligvis var der da du overtok bilen?"],
  ["mer_enn_normal_slitasje", "Står det at feilen er mer enn normal slitasje for alder og kjørelengde?"],
  ["kostnad", "Står det hva reparasjonen koster?"],
] as const;
const SELGERS_SVAR: Valgliste<NonNullable<Kontakt["selgers_svar"]>> = [
  ["ikke_svart", "Ikke svart"],
  ["avvist", "Avvist"],
  ["tilbudt_reparasjon", "Tilbudt reparasjon"],
  ["tilbudt_delvis", "Tilbudt noe, men ikke alt"],
  ["enige_om_noe", "Vi ble enige om noe"],
];

const nyFeil = (id: string): SkjemaFeil => ({
  id,
  kategori: "motor",
  en_setning: "",
  dato_oppdaget: "",
  kan_bilen_brukes: "ja",
  selger_sa_noe: "nei",
  hvor_sto_det: [],
  avskrift_selger: null,
  svar_pa_direkte_sporsmal: false,
  verksted_sett_pa: "nei",
  verksted_navn_dato: null,
  rapport_sier: RAPPORT_TOM,
  kostnad_kr: null,
  kostnad_over_pris_bekreftet: false,
  avskrift_verksted: null,
});

// An empty form: the buyer and the confirmations are asked, not filled in.
const TOMT: Skjema = {
  _meta: { skjema_versjon: SKJEMA_VERSJON, registrert: "" },
  del1_kjopet: { selgertype: "forhandler", kjopsdato: "", pris_kr: 0, km_ved_kjop: 0, aarsmodell: 0, merke_modell_valgfritt: null },
  del2_selger: { firmanavn_oppgitt: null, bronnoysund_treff: null, treff_bekreftet: false, som_den_er_i_kontrakt: "vet_ikke" },
  del3_feil: [nyFeil("F1")],
  km_na: 0,
  del6_kontakt_med_selger: {
    tatt_opp_med_selger: "nei",
    dato_forste_gang: null,
    selgers_svar: null,
    avtale_inngatt: "nei",
    avtale_beskrivelse: null,
    avtale_gjelder_feil: [],
    selger_la_frem_dokumentasjon: "nei",
    selger_dokumentasjon_kort: null,
  },
  del7_onske_og_kontakt: { onsket_losning: "reparasjon", kjoper: { navn: "", adresse: "", epost: "" } },
  bekreftelser: { opplysningene_er_riktige: false, lest_at_brevet_ikke_er_juridisk_radgivning: false },
};

// Validation paths in the buyer's words: «del3_feil[1].en_setning» → «Feil 2».
function delnavn(felt: string): string {
  const feil = /^del3_feil\[(\d+)\]/.exec(felt);
  if (feil) return `Feil ${Number(feil[1]) + 1}`;
  if (felt.startsWith("del1_kjopet")) return "Kjøpet";
  if (felt.startsWith("del2_selger")) return "Selger";
  if (felt === "km_na" || felt.startsWith("del6")) return "Kontakt med selger";
  if (felt.startsWith("del7")) return "Ønske og kontakt";
  if (felt.startsWith("bekreftelser")) return "Bekreftelser";
  return "Skjemaet";
}

// Hidden answers are kept while the user toggles; the engine gets what the form would send (spec § 3–4).
function tilMotor(s: Skjema, registrert: string): Skjema {
  const k = s.del6_kontakt_med_selger;
  const tattOpp = k.tatt_opp_med_selger !== "nei";
  const svar = tattOpp ? k.selgers_svar : null;
  const avtale = svar === "tilbudt_delvis" || svar === "enige_om_noe" ? k.avtale_inngatt : "nei";
  const dok = svar === "avvist" ? k.selger_la_frem_dokumentasjon : "nei";
  return {
    ...s,
    _meta: { skjema_versjon: SKJEMA_VERSJON, registrert },
    del3_feil: s.del3_feil.map((f, i) => {
      const skriftlig = f.selger_sa_noe === "ja_skriftlig";
      const hvor = skriftlig ? f.hvor_sto_det : [];
      const rapport = f.verksted_sett_pa === "ja_skriftlig";
      const r = rapport ? f.rapport_sier : RAPPORT_TOM;
      return {
        ...f,
        id: `F${i + 1}`,
        hvor_sto_det: hvor,
        avskrift_selger: skriftlig ? f.avskrift_selger : null,
        svar_pa_direkte_sporsmal: hvor.includes("sms_epost_chat") && f.svar_pa_direkte_sporsmal,
        verksted_navn_dato: rapport ? f.verksted_navn_dato : null,
        rapport_sier: r,
        kostnad_kr: r.kostnad === "ja" ? f.kostnad_kr : null,
        // Only a cost above the price can be confirmed; a corrected amount drops the confirmation.
        kostnad_over_pris_bekreftet: r.kostnad === "ja" && (f.kostnad_kr ?? 0) > s.del1_kjopet.pris_kr && f.kostnad_over_pris_bekreftet,
        avskrift_verksted: rapport ? f.avskrift_verksted : null,
      };
    }),
    del6_kontakt_med_selger: {
      tatt_opp_med_selger: k.tatt_opp_med_selger,
      dato_forste_gang: tattOpp ? k.dato_forste_gang : null,
      selgers_svar: svar,
      avtale_inngatt: avtale,
      avtale_beskrivelse: avtale === "ja" ? k.avtale_beskrivelse : null,
      avtale_gjelder_feil: avtale === "ja" ? k.avtale_gjelder_feil.filter((id) => Number(id.slice(1)) <= s.del3_feil.length) : [],
      selger_la_frem_dokumentasjon: dok,
      selger_dokumentasjon_kort: dok === "ja" ? k.selger_dokumentasjon_kort : null,
    },
  };
}

const ETIKETT = "text-[13px] font-medium text-[#3d4757]";
const INPUT = "rounded border border-[#dcd8cf] bg-white px-3 py-2 text-[15px] text-[#17263d] outline-none focus:border-[#1f3a5f]";
const KORT = "flex flex-col gap-4 rounded border border-[#dcd8cf] bg-white/60 p-5";
const MERKNAD = "m-0 rounded bg-[#ecebe7] px-3 py-2 text-[13px] text-[#3d4757]";

function Felt({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <label className="relative flex flex-col gap-1.5">
      <span className={ETIKETT}>{navn}</span>
      {children}
    </label>
  );
}

function Valg<T extends string>({ navn, verdi, valg, onChange }: { navn: string; verdi: T | null | undefined; valg: Valgliste<T>; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={navn} className="flex flex-col gap-1.5">
      <span className={ETIKETT}>{navn}</span>
      <div className="flex flex-wrap gap-1.5">
        {valg.map(([v, tekst]) => (
          <button
            key={v}
            type="button"
            aria-pressed={verdi === v}
            onClick={() => onChange(v)}
            className="rounded border border-[#dcd8cf] bg-white px-3 py-1.5 text-[14px] aria-pressed:border-[#1f3a5f] aria-pressed:bg-[#1f3a5f] aria-pressed:text-white"
          >
            {tekst}
          </button>
        ))}
      </div>
    </div>
  );
}

function Tall({ navn, verdi, onChange, paakrevd }: { navn: string; verdi: number | null; onChange: (v: number | null) => void; paakrevd?: boolean }) {
  return (
    <Felt navn={navn}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        required={paakrevd}
        className={INPUT}
        value={verdi ? verdi : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </Felt>
  );
}

const tilIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Dato({ navn, verdi, onChange, paakrevd }: { navn: string; verdi: string | null; onChange: (v: string) => void; paakrevd?: boolean }) {
  const [apen, setApen] = useState(false);
  const dato = verdi ? new Date(`${verdi}T00:00:00`) : undefined;
  return (
    <Felt navn={navn}>
      <Popover open={apen} onOpenChange={setApen}>
        <PopoverTrigger asChild>
          <button type="button" className={`${INPUT} flex items-center justify-between gap-2 text-left`}>
            {dato ? dato.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }) : <span className="text-[#8a8577]">Velg dato</span>}
            <CalendarIcon className="size-4 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={nb}
            captionLayout="dropdown"
            startMonth={new Date(2000, 0)}
            endMonth={new Date(new Date().getFullYear() + 1, 11)}
            selected={dato}
            defaultMonth={dato}
            onSelect={(d) => {
              if (d) onChange(tilIso(d));
              setApen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {paakrevd && <input tabIndex={-1} aria-hidden required value={verdi ?? ""} onChange={() => {}} className="pointer-events-none absolute h-0 w-0 opacity-0" />}
    </Felt>
  );
}

function Tekst({ navn, verdi, onChange, rader = 2, paakrevd }: { navn: string; verdi: string | null; onChange: (v: string | null) => void; rader?: number; paakrevd?: boolean }) {
  return (
    <Felt navn={navn}>
      <textarea required={paakrevd} rows={rader} className={INPUT} value={verdi ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </Felt>
  );
}

// Looked up first in Statens vegvesen (/api/kjoretoy); `funnet` fills in what the registry knows.
// It sits inside the form, so Enter looks the vehicle up instead of submitting.
function Regnr({ funnet }: { funnet: (k: Kjoretoy, eierFra: string | null) => void }) {
  const [regnr, setRegnr] = useState("");
  const [henter, setHenter] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);

  async function hent() {
    if (!regnr.trim() || henter) return;
    setHenter(true);
    setMelding(null);
    try {
      const res = await fetch(`/api/kjoretoy?${new URLSearchParams({ regnr })}`);
      const json = (await res.json()) as { kjoretoy?: Kjoretoy; eierFra?: string | null; feil?: string };
      if (!json.kjoretoy) throw new Error(json.feil ?? "Noe gikk galt. Prøv igjen.");
      const k = json.kjoretoy;
      funnet(k, json.eierFra ?? null);
      setMelding({
        ok: true,
        tekst: [
          k.regnr,
          `${k.merke} ${k.modell}`,
          k.ar && `første gang registrert ${k.ar}`,
          json.eierFra && `på nåværende eier siden ${json.eierFra}`,
          k.bruktimportert && "bruktimportert",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } catch (e) {
      setMelding({ ok: false, tekst: e instanceof Error && !(e instanceof TypeError) ? e.message : "Noe gikk galt. Prøv igjen." });
    } finally {
      setHenter(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Felt navn="Registreringsnummer">
        <div className="flex gap-2">
          <input
            className={`${INPUT} min-w-0 flex-1 font-kode uppercase tracking-[.06em]`}
            value={regnr}
            onChange={(e) => setRegnr(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void hent();
            }}
            autoComplete="off"
            spellCheck={false}
            maxLength={8}
            placeholder="AB 12345"
          />
          <button
            type="button"
            onClick={() => void hent()}
            disabled={!regnr.trim() || henter}
            className="rounded border border-[#1f3a5f] px-4 py-2 text-[14px] font-medium text-[#1f3a5f] disabled:opacity-50"
          >
            {henter ? "Henter …" : "Hent bilen"}
          </button>
        </div>
      </Felt>
      {melding && (
        <p role={melding.ok ? "status" : "alert"} className={`m-0 text-[13px] ${melding.ok ? "text-[#1f5a2e]" : "text-[#a3372b]"}`}>
          {melding.ok ? `${melding.tekst}. Merke, årsmodell og kjøpsdato er fylt inn under.` : melding.tekst}
        </p>
      )}
    </div>
  );
}

// 16f: a repair dearer than the car is a rescission case or a typo (52 000 for 520 000 kr). The buyer
// confirms it or corrects one of the amounts; the letter never states an unconfirmed share over 100 %.
function KostnadOverPris({ kostnad, pris, bekreftet, endre }: { kostnad: number; pris: number; bekreftet: boolean; endre: (p: Partial<SkjemaFeil>) => void }) {
  const kr = (n: number) => `${n.toLocaleString("nb-NO")} kr`;
  return (
    <div role="alertdialog" aria-label="Kontroller beløpene" className="flex flex-col gap-3 rounded border border-[#d9b98a] bg-[#fbf3e6] p-4 text-[14px] text-[#3d4757]">
      <p className="m-0">
        Reparasjonen koster <strong>{kr(kostnad)}</strong>, mer enn de <strong>{kr(pris)}</strong> du betalte for bilen. Stemmer begge beløpene? Sjekk at kjøpesummen ikke mangler et siffer.
      </p>
      {bekreftet ? (
        <p className="m-0 font-medium text-[#1f5a2e]">✓ Du har bekreftet beløpene.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => endre({ kostnad_over_pris_bekreftet: true })} className="rounded bg-[#17263d] px-3 py-2 font-semibold text-[#f6f4ef]">
            Ja, beløpene stemmer
          </button>
          <span className="self-center text-[13px]">Hvis ikke: rett kostnaden her eller kjøpesummen under «Kjøpet».</span>
        </div>
      )}
    </div>
  );
}

function Feilskjema({ f, nr, pris, endre, fjern }: { f: SkjemaFeil; nr: number; pris: number; endre: (p: Partial<SkjemaFeil>) => void; fjern?: () => void }) {
  return (
    <div className={KORT}>
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[16px] font-semibold">Feil F{nr}</h3>
        {fjern && (
          <button type="button" onClick={fjern} className="text-[13px] text-[#8a3b2e] underline">
            Fjern
          </button>
        )}
      </div>
      <Felt navn="Hva slags feil er det?">
        <select className={INPUT} value={f.kategori} onChange={(e) => endre({ kategori: e.target.value as SkjemaFeil["kategori"] })}>
          {KATEGORIER.map((k) => (
            <option key={k.nokkel} value={k.nokkel}>
              {k.navn}
            </option>
          ))}
        </select>
      </Felt>
      <Tekst navn="Beskriv feilen med èn setning" verdi={f.en_setning} onChange={(v) => endre({ en_setning: v ?? "" })} paakrevd />
      <Dato navn="Når oppdaget du feilen?" verdi={f.dato_oppdaget} onChange={(v) => endre({ dato_oppdaget: v })} paakrevd />
      <Valg
        navn="Kan bilen brukes?"
        verdi={f.kan_bilen_brukes}
        valg={[
          ["ja", "Ja"],
          ["ja_begrenset", "Ja, men begrenset"],
          ["nei", "Nei"],
        ]}
        onChange={(v) => endre({ kan_bilen_brukes: v })}
      />

      <Valg
        navn="Sa eller skrev selger noe om dette før kjøpet?"
        verdi={f.selger_sa_noe}
        valg={[
          ["nei", "Nei"],
          ["ja_skriftlig", "Ja, skriftlig"],
          ["ja_muntlig", "Ja, muntlig"],
        ]}
        onChange={(v) => endre({ selger_sa_noe: v })}
      />
      {f.selger_sa_noe === "ja_muntlig" && (
        <p className={MERKNAD}>Muntlige løfter er vanskelige å bevise og teller sjelden alene. Vi tar det med i beskrivelsen, men bygger ikke kravet på det.</p>
      )}
      {f.selger_sa_noe === "ja_skriftlig" && (
        <div className="flex flex-col gap-4 border-l-2 border-[#dcd8cf] pl-4">
          <div role="group" aria-label="Hvor sto det?" className="flex flex-col gap-1.5">
            <span className={ETIKETT}>Hvor sto det?</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {HVOR_STO_DET.map((h) => (
                <label key={h.nokkel} className="flex items-center gap-2 text-[14px]">
                  <input
                    type="checkbox"
                    checked={f.hvor_sto_det.includes(h.nokkel)}
                    onChange={(e) => endre({ hvor_sto_det: e.target.checked ? [...f.hvor_sto_det, h.nokkel] : f.hvor_sto_det.filter((x) => x !== h.nokkel) })}
                  />
                  {h.navn}
                </label>
              ))}
            </div>
          </div>
          <Tekst navn="Skriv av det som sto, så nøyaktig du kan" verdi={f.avskrift_selger} onChange={(v) => endre({ avskrift_selger: v })} rader={3} />
          {f.hvor_sto_det.includes("sms_epost_chat") && (
            <Valg
              navn="Var dette svar på et spørsmål du stilte selger?"
              verdi={f.svar_pa_direkte_sporsmal ? "ja" : "nei"}
              valg={JA_NEI}
              onChange={(v) => endre({ svar_pa_direkte_sporsmal: v === "ja" })}
            />
          )}
        </div>
      )}

      <Valg
        navn="Har et verksted sett på feilen?"
        verdi={f.verksted_sett_pa}
        valg={[
          ["nei", "Nei"],
          ["ja_skriftlig", "Ja, skriftlig"],
          ["ja_muntlig", "Ja, muntlig"],
        ]}
        onChange={(v) => endre({ verksted_sett_pa: v })}
      />
      {f.verksted_sett_pa === "ja_skriftlig" && (
        <div className="flex flex-col gap-4 border-l-2 border-[#dcd8cf] pl-4">
          <Felt navn="Hvilket verksted, og når?">
            <input className={INPUT} value={f.verksted_navn_dato ?? ""} onChange={(e) => endre({ verksted_navn_dato: e.target.value || null })} />
          </Felt>
          {RAPPORT_SPORSMAL.map(([k, t]) => (
            <Valg key={k} navn={t} verdi={f.rapport_sier[k]} valg={RAPPORTSVAR} onChange={(v) => endre({ rapport_sier: { ...f.rapport_sier, [k]: v } })} />
          ))}
          {f.rapport_sier.kostnad === "ja" && <Tall navn="Hvor mye? (kr)" verdi={f.kostnad_kr} onChange={(v) => endre({ kostnad_kr: v, kostnad_over_pris_bekreftet: false })} />}
          {f.rapport_sier.kostnad === "ja" && f.kostnad_kr != null && pris > 0 && f.kostnad_kr > pris && (
            <KostnadOverPris kostnad={f.kostnad_kr} pris={pris} bekreftet={f.kostnad_over_pris_bekreftet} endre={endre} />
          )}
          <Tekst navn="Verkstedet skriver at …" verdi={f.avskrift_verksted} onChange={(v) => endre({ avskrift_verksted: v })} rader={3} />
        </div>
      )}
    </div>
  );
}

function Merke({ children, mork }: { children: React.ReactNode; mork?: boolean }) {
  return <span className={`rounded px-2 py-0.5 text-[12px] font-medium ${mork ? "bg-[#1f3a5f] text-white" : "bg-[#ecebe7] text-[#3d4757]"}`}>{children}</span>;
}

const STYRKE: Record<string, string> = { sterk: "Sterk", middels: "Middels", svak: "Svak" };
const INGEN_SPOR: Record<string, string> = {
  muntlig_opplysning: "Selgers løfte var muntlig, og det er vanskelig å bevise.",
  rapport_mangler: "Det mangler skriftlig dokumentasjon fra et verksted av hva som er feil.",
  utenfor_frist: "Feilen viste seg etter fristen der loven legger til grunn at den var der ved kjøpet, og rapporten sier ikke at den går ut over normal slitasje.",
};
// The committee's reasons in lost cases (pass 2), as the buyer reads them.
const TAPSGRUNN: Record<string, string> = {
  paregnelig_slitasje: "påregnelig slitasje",
  ikke_dokumentert: "feilen var ikke dokumentert",
  ikke_sannsynliggjort_ved_levering: "ikke vist at feilen var der ved leveringen",
  kjent_eller_opplyst: "feilen var kjent eller opplyst ved kjøpet",
  synlig_ved_besiktigelse: "feilen var synlig ved besiktigelse",
  oppstatt_etter_levering: "feilen oppsto etter leveringen",
  forbehold: "forbehold i kontrakten",
};
const LENKE = "font-medium text-[#1f3a5f] underline";
const TEKST = "m-0 text-[14px] leading-[1.6] text-[#3d4757]";

// What similar cases lost on, for deciding whether to order a report: never the strength, never the letter.
function Tapte({ tapte }: { tapte: NonNullable<FeilSvar["tapte"]> }) {
  const grunner = Object.entries(tapte.fordeling)
    .filter(([g]) => TAPSGRUNN[g])
    .sort((a, b) => b[1] - a[1]);
  if (!grunner.length) return null;
  return (
    <p className="m-0 text-[13px] leading-[1.6] text-[#5b6472]">
      Lignende saker har tapt på: {grunner.map(([g, n]) => `${TAPSGRUNN[g]} ${n}`).join(", ")}. De nyeste:{" "}
      {tapte.nyeste.map((v, i) => (
        <span key={v.saksnummer}>
          {i > 0 && " og "}
          <a href={v.kilde_url} target="_blank" rel="noreferrer" className="text-[#1f3a5f] underline">
            {v.saksnummer}
          </a>
        </span>
      ))}
      .
    </p>
  );
}

// What the buyer sees: the strength of each defect and why. The letter's practice paragraph is written
// on request, from the decisions behind this assessment.
function Brukerresultat({ svar }: { svar: Extract<SakSvar, { ok: true }> }) {
  if (svar.stopp) return <p className={MERKNAD}>Kjøp fra privatperson dekkes ikke av tjenesten ennå.</p>;
  return (
    <>
      <h2 className="m-0 font-brev text-[26px] font-semibold">Vurderingen</h2>
      {svar.feil.map((f, i) => (
        <article key={f.feil_id} className={KORT}>
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-[16px] font-semibold">Feil {i + 1}</h3>
            {f.styrke && <Merke mork={f.styrke === "sterk"}>{STYRKE[f.styrke]}</Merke>}
          </header>
          {f.forlik ? (
            <p className={TEKST}>Dere har inngått en avtale om denne feilen, så den tas ikke med i brevet.</p>
          ) : f.vedtak ? (
            <p className={TEKST}>
              Forbrukerklageutvalget har gitt medhold i en sak om samme type feil som ikke var sterkere enn din:{" "}
              <a href={f.vedtak.kilde_url} target="_blank" rel="noreferrer" className={LENKE}>
                vedtak {f.vedtak.saksnummer}
              </a>
              {f.flere_vedtak > 0 && ` (og ${f.flere_vedtak} til)`}.
            </p>
          ) : f.styrke_grunn === "ingen_spor" ? (
            <p className={TEKST}>{(f.ingen_spor_arsak && INGEN_SPOR[f.ingen_spor_arsak]) ?? "Saken mangler dokumentasjon brevet kan bygge på."}</p>
          ) : (
            <>
              <p className={TEKST}>Vi fant ikke et vedtak om samme type feil som saken din er minst like sterk som. Brevet bygger på loven og dokumentasjonen din.</p>
              {f.tapte && <Tapte tapte={f.tapte} />}
            </>
          )}
          {f.reklamasjon_over_to_mnd && (
            <p className="m-0 text-[14px] leading-[1.6] text-[#8a3b12]">
              Du tok opp feilen med selger mer enn to måneder etter at du oppdaget den. Loven krever at du gjør det innen rimelig tid, og to måneder regnes alltid som tidsnok
              (forbrukerkjøpsloven § 27). Senere enn det kan selger avvise kravet, og saken er derfor høyst middels.
            </p>
          )}
        </article>
      ))}
    </>
  );
}

// The letter's practice section, written on request from the decisions behind the assessment: the model
// reads them and the verifier keeps only what their full text supports (docs/praksis.md).
function Brevet({ skjema, svar }: { skjema: Skjema; svar: Extract<SakSvar, { ok: true }> }) {
  const [praksis, setPraksis] = useState<PraksisUt | null>(null);
  const [skriver, start] = useTransition();
  if (svar.stopp) return null;
  return (
    <article className="flex flex-col gap-4 rounded border border-[#dcd8cf] bg-white px-6 py-8 shadow-[0_18px_40px_-24px_rgba(23,38,61,.35)] md:px-10">
      <span className={ETIKETT}>Brevet</span>
      <h2 className="m-0 font-brev text-[20px] font-semibold">Praksis fra Forbrukerklageutvalget</h2>
      {!praksis?.ok ? (
        <>
          {svar.valgt_til_brev.length ? (
            <button
              type="button"
              disabled={skriver}
              onClick={() => start(async () => setPraksis(await skrivPraksisFor(skjema)))}
              className="self-start rounded bg-[#1f3a5f] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60"
            >
              {skriver ? "Leser vedtakene …" : "Skriv praksisavsnittet"}
            </button>
          ) : (
            <p className={MERKNAD}>Brevet har ingen praksisdel for disse feilene. Det bygger på loven og dokumentasjonen.</p>
          )}
          {praksis && !praksis.ok && (
            <p role="alert" className={MERKNAD}>
              {praksis.melding}
            </p>
          )}
        </>
      ) : praksis.avsnitt.length ? (
        <>
          {praksis.avsnitt.map((a) => (
            <p key={a.feil_id} className="m-0 font-brev text-[16px] leading-[1.7] text-[#17263d]">
              {a.avsnitt}
            </p>
          ))}
          {praksis.lovendring && <p className="m-0 font-brev text-[16px] leading-[1.7] text-[#17263d]">{praksis.lovendring}</p>}
        </>
      ) : (
        <p className={MERKNAD}>Vi kunne ikke belegge et avsnitt om vedtakene med vedtaksteksten, så brevet viser ikke til et enkeltvedtak. Det bygger på loven og dokumentasjonen.</p>
      )}
    </article>
  );
}

// The one form (decided 2026-10-10): the assessment and the letter are built on this page.
export function Sakskjema() {
  const [s, setS] = useState<Skjema>(TOMT);
  const [brukersvar, setBrukersvar] = useState<SakSvar | null>(null);
  // The form as sent: the letter is written from what was assessed, not from later edits.
  const [sendt, setSendt] = useState<Skjema | null>(null);
  const [forsokt, setForsokt] = useState(false);
  const [idag] = useState(() => new Date().toISOString().slice(0, 10));
  const [venter, start] = useTransition();

  type Del = "del1_kjopet" | "del2_selger" | "del6_kontakt_med_selger" | "del7_onske_og_kontakt";
  const del =
    <K extends Del>(k: K) =>
    (p: Partial<Skjema[K]>) =>
      setS((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const k1 = del("del1_kjopet");
  const k6 = del("del6_kontakt_med_selger");
  const kontakt = s.del6_kontakt_med_selger;
  const privat = s.del1_kjopet.selgertype === "privat";

  // The registry has no model year, only the first registration; the current owner's registration
  // day is the suggested purchase date. Everything stays editable.
  const fraVegvesen = (k: Kjoretoy, eierFra: string | null) =>
    k1({
      merke_modell_valgfritt: `${k.merke} ${k.modell}`.slice(0, 60),
      ...(k.ar ? { aarsmodell: k.ar } : {}),
      ...(eierFra ? { kjopsdato: eierFra } : {}),
    });
  const endreFeil = (i: number) => (p: Partial<SkjemaFeil>) => setS((x) => ({ ...x, del3_feil: x.del3_feil.map((f, j) => (j === i ? { ...f, ...p } : f)) }));
  // Render must be deterministic (hydration); the real timestamp is set on submit.
  const sendes = tilMotor(s, `${idag}T00:00:00.000Z`);
  const valideringsfeil = validerSkjema(sendes, idag);

  return (
    <div className="min-h-screen bg-[#f6f4ef] font-ui text-[#17263d]">
      {/* minmax(0, 1fr): without it the single mobile column grows with its content (464 px in a 412 px screen). */}
      <div className="mx-auto grid max-w-[720px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 lg:px-8">
        <form
          className="flex flex-col gap-6"
          // The buyer gets the whole list of what is missing, not the browser's one field at a time.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const skjema = tilMotor(s, new Date().toISOString());
            // The buyer's form is only sent when it passes validation; the server checks again.
            setForsokt(true);
            if (validerSkjema(skjema, idag).length) return;
            start(async () => {
              setBrukersvar(await sendSak(skjema));
              setSendt(skjema);
            });
          }}
        >
          <header className="flex flex-col gap-3">
            <h1 className="m-0 font-brev text-[30px] font-semibold">Reklamasjon på bruktbil</h1>
            <p className="m-0 text-[14px] text-[#5b6472]">Svar på spørsmålene om kjøpet og feilen. Du får en vurdering av saken og brevet under skjemaet.</p>
          </header>

          <section className={KORT}>
            <h2 className="m-0 text-[18px] font-semibold">Bilen</h2>
            <Regnr funnet={fraVegvesen} />
          </section>

          <section className={KORT}>
            <h2 className="m-0 text-[18px] font-semibold">Kjøpet</h2>
            <Valg
              navn="Kjøpte du bilen av et firma (forhandler) eller en privatperson?"
              verdi={s.del1_kjopet.selgertype}
              valg={[
                ["forhandler", "Forhandler"],
                ["privat", "Privatperson"],
              ]}
              onChange={(v) => k1({ selgertype: v })}
            />
            {privat && <p className={MERKNAD}>Kjøpsloven gjelder, og tjenesten dekker foreløpig bare kjøp fra forhandler. Motoren stopper her.</p>}
            <div className="grid grid-cols-2 gap-4">
              <Dato navn="Når kjøpte du bilen?" verdi={s.del1_kjopet.kjopsdato} onChange={(v) => k1({ kjopsdato: v })} paakrevd />
              <Tall navn="Hva betalte du? (kr)" verdi={s.del1_kjopet.pris_kr} onChange={(v) => k1({ pris_kr: v ?? 0 })} paakrevd />
              <Tall navn="Kilometerstand ved kjøp" verdi={s.del1_kjopet.km_ved_kjop} onChange={(v) => k1({ km_ved_kjop: v ?? 0 })} paakrevd />
              <Tall navn="Årsmodell" verdi={s.del1_kjopet.aarsmodell} onChange={(v) => k1({ aarsmodell: v ?? 0 })} paakrevd />
            </div>
            <Felt navn="Merke og modell (valgfritt)">
              <input className={INPUT} value={s.del1_kjopet.merke_modell_valgfritt ?? ""} onChange={(e) => k1({ merke_modell_valgfritt: e.target.value || null })} />
            </Felt>
          </section>

          {!privat && (
            <>
              <section className={KORT}>
                <h2 className="m-0 text-[18px] font-semibold">Selger</h2>
                <Forhandlervelger
                  navn={s.del2_selger.firmanavn_oppgitt ?? ""}
                  treff={s.del2_selger.treff_bekreftet ? s.del2_selger.bronnoysund_treff : null}
                  onChange={(v) => del("del2_selger")(v)}
                  inputClass={INPUT}
                  labelClass={ETIKETT}
                />
                <Valg
                  navn="Sto det «som den er», «som forevist» eller lignende i kontrakten?"
                  verdi={s.del2_selger.som_den_er_i_kontrakt}
                  valg={[...JA_NEI, ["vet_ikke", "Vet ikke"]]}
                  onChange={(v) => del("del2_selger")({ som_den_er_i_kontrakt: v })}
                />
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="m-0 text-[18px] font-semibold">Feil</h2>
                {s.del3_feil.map((f, i) => (
                  <Feilskjema
                    key={i}
                    f={f}
                    nr={i + 1}
                    pris={s.del1_kjopet.pris_kr}
                    endre={endreFeil(i)}
                    fjern={s.del3_feil.length > 1 ? () => setS((x) => ({ ...x, del3_feil: x.del3_feil.filter((_, j) => j !== i) })) : undefined}
                  />
                ))}
                {s.del3_feil.length < MAKS_FEIL && (
                  <button
                    type="button"
                    onClick={() => setS((x) => ({ ...x, del3_feil: [...x.del3_feil, nyFeil(`F${x.del3_feil.length + 1}`)] }))}
                    className="self-start rounded border border-[#1f3a5f] px-4 py-2 text-[14px] font-medium text-[#1f3a5f]"
                  >
                    Legg til feil
                  </button>
                )}
              </section>

              <section className={KORT}>
                <h2 className="m-0 text-[18px] font-semibold">Kontakt med selger</h2>
                <Tall navn="Hva er kilometerstanden nå?" verdi={s.km_na} onChange={(v) => setS((x) => ({ ...x, km_na: v ?? 0 }))} paakrevd />
                <Valg
                  navn="Har du tatt dette opp med selger?"
                  verdi={kontakt.tatt_opp_med_selger}
                  valg={[
                    ["nei", "Nei"],
                    ["ja_muntlig", "Ja, muntlig"],
                    ["ja_skriftlig", "Ja, skriftlig"],
                  ]}
                  onChange={(v) => k6({ tatt_opp_med_selger: v })}
                />
                {kontakt.tatt_opp_med_selger !== "nei" && (
                  <div className="flex flex-col gap-4 border-l-2 border-[#dcd8cf] pl-4">
                    <Dato navn="Når tok du det opp første gang?" verdi={kontakt.dato_forste_gang} onChange={(v) => k6({ dato_forste_gang: v || null })} paakrevd />
                    <Valg navn="Hva svarte selger?" verdi={kontakt.selgers_svar} valg={SELGERS_SVAR} onChange={(v) => k6({ selgers_svar: v })} />
                    {(kontakt.selgers_svar === "tilbudt_delvis" || kontakt.selgers_svar === "enige_om_noe") && (
                      <>
                        <Valg navn="Har dere inngått en avtale eller et forlik?" verdi={kontakt.avtale_inngatt} valg={JA_NEI} onChange={(v) => k6({ avtale_inngatt: v })} />
                        {kontakt.avtale_inngatt === "ja" && (
                          <>
                            <Tekst navn="Avtalen går ut på at …" verdi={kontakt.avtale_beskrivelse} onChange={(v) => k6({ avtale_beskrivelse: v })} />
                            <div role="group" aria-label="Hvilke av feilene gjelder avtalen?" className="flex flex-col gap-1.5">
                              <span className={ETIKETT}>Hvilke av feilene gjelder avtalen?</span>
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                {s.del3_feil.map((_, i) => {
                                  const id = `F${i + 1}`;
                                  const valgt = kontakt.avtale_gjelder_feil.includes(id);
                                  return (
                                    <label key={id} className="flex items-center gap-2 text-[14px]">
                                      <input
                                        type="checkbox"
                                        checked={valgt}
                                        onChange={() => k6({ avtale_gjelder_feil: valgt ? kontakt.avtale_gjelder_feil.filter((x) => x !== id) : [...kontakt.avtale_gjelder_feil, id].sort() })}
                                      />
                                      {id}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {kontakt.selgers_svar === "avvist" && (
                      <>
                        <Valg
                          navn="La selger frem dokumentasjon (rapport, verkstedhistorikk)?"
                          verdi={kontakt.selger_la_frem_dokumentasjon}
                          valg={JA_NEI}
                          onChange={(v) => k6({ selger_la_frem_dokumentasjon: v })}
                        />
                        {kontakt.selger_la_frem_dokumentasjon === "ja" && (
                          <Tekst navn="Hva slags?" verdi={kontakt.selger_dokumentasjon_kort} onChange={(v) => k6({ selger_dokumentasjon_kort: v })} />
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>

              <section className={KORT}>
                <h2 className="m-0 text-[18px] font-semibold">Ønske</h2>
                <Valg
                  navn="Hva ønsker du?"
                  verdi={s.del7_onske_og_kontakt.onsket_losning}
                  valg={[
                    ["reparasjon", "Reparasjon"],
                    ["prisavslag", "Prisavslag"],
                    ["angre_kjopet", "Angre kjøpet"],
                  ]}
                  onChange={(v) => del("del7_onske_og_kontakt")({ onsket_losning: v })}
                />
                {s.del7_onske_og_kontakt.onsket_losning === "angre_kjopet" && (
                  <p className={MERKNAD}>Å gå fra kjøpet krever at feilen er vesentlig. Brevet vil kreve det, men også ta forbehold om prisavslag.</p>
                )}
                {(["navn", "adresse", "epost"] as const).map((k) => (
                      <Felt key={k} navn={{ navn: "Navnet ditt", adresse: "Adressen din (avsender i brevet)", epost: "E-postadressen din" }[k]}>
                        <input
                          className={INPUT}
                          type={k === "epost" ? "email" : "text"}
                          autoComplete={{ navn: "name", adresse: "street-address", epost: "email" }[k]}
                          value={s.del7_onske_og_kontakt.kjoper[k]}
                          onChange={(e) => del("del7_onske_og_kontakt")({ kjoper: { ...s.del7_onske_og_kontakt.kjoper, [k]: e.target.value } })}
                        />
                      </Felt>
                    ))}
              </section>

                <section className={KORT}>
                  <h2 className="m-0 text-[18px] font-semibold">Bekreft</h2>
                  {(
                    [
                      ["opplysningene_er_riktige", "Opplysningene jeg har gitt, er riktige så langt jeg vet."],
                      ["lest_at_brevet_ikke_er_juridisk_radgivning", "Jeg har lest at brevet ikke er juridisk rådgivning."],
                    ] as const
                  ).map(([k, tekst]) => (
                    <label key={k} className="flex items-start gap-3 text-[15px]">
                      <input type="checkbox" className="mt-1" checked={s.bekreftelser[k]} onChange={(e) => setS((x) => ({ ...x, bekreftelser: { ...x.bekreftelser, [k]: e.target.checked } }))} />
                      {tekst}
                    </label>
                  ))}
                </section>
            </>
          )}

          {valideringsfeil.length > 0 && forsokt && (
            <div role="alert" className="rounded border border-[#e8c9a0] bg-[#fbf3e8] px-4 py-3 text-[13px] text-[#7a4a12]">
              <p className="m-0 font-medium">Noen svar mangler eller må rettes:</p>
              <ul className="m-0 mt-1 pl-4">
                {valideringsfeil.map((v, i) => (
                  <li key={i}>
                    {delnavn(v.felt)}: {v.melding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brukersvar && !brukersvar.ok && (
            <p role="alert" className="m-0 rounded bg-[#f6dcd7] px-4 py-3 text-[14px] text-[#8a3b2e]">
              {"melding" in brukersvar ? brukersvar.melding : `Svarene ble ikke godtatt: ${brukersvar.feil.map((v) => `${delnavn(v.felt)}: ${v.melding}`).join("; ")}`}
            </p>
          )}

          <button type="submit" disabled={venter} className="sticky bottom-4 z-10 rounded bg-[#1f3a5f] px-5 py-3 text-[16px] font-semibold text-white shadow-lg disabled:opacity-60">
            {venter ? "Vurderer …" : "Se vurderingen og brevet"}
          </button>
        </form>

        {brukersvar?.ok && (
          <section aria-live="polite" className="flex flex-col gap-6">
            <Brukerresultat svar={brukersvar} />
            {sendt && <Brevet key={JSON.stringify(sendt)} skjema={sendt} svar={brukersvar} />}
          </section>
        )}
      </div>
    </div>
  );
}
