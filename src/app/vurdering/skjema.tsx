"use client";

import { useState, useTransition } from "react";
import type { Resultat } from "@/lib/sammenligning";
import type { FeilResultat } from "@/lib/sammenligning/typer";
import { HVOR_STO_DET, KATEGORIER, MAKS_FEIL, RAPPORT_TOM, SKJEMA_VERSJON, validerSkjema, type Skjema, type SkjemaFeil } from "@/lib/skjema/skjema";
import { vurder, type Svar } from "./actions";

type Eksempel = { id: string; navn: string; skjema: Skjema };
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
  avskrift_verksted: null,
});

// The engine does not read the buyer or the confirmations, so the test form fills them in.
const TOMT: Skjema = {
  _meta: { skjema_versjon: SKJEMA_VERSJON, registrert: "" },
  del1_kjopet: { selgertype: "forhandler", kjopsdato: "", pris_kr: 0, km_ved_kjop: 0, aarsmodell: 0, merke_modell_valgfritt: null },
  del2_selger: { firmanavn_oppgitt: "Testbil AS", bronnoysund_treff: null, treff_bekreftet: false, som_den_er_i_kontrakt: "vet_ikke" },
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
  del7_onske_og_kontakt: { onsket_losning: "reparasjon", kjoper: { navn: "Test Testesen", adresse: "Prøvegata 1, 0150 Oslo", epost: "test@example.no" } },
  bekreftelser: { opplysningene_er_riktige: true, lest_at_brevet_ikke_er_juridisk_radgivning: true },
};

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
const kr = (n: number | null | undefined) => (n == null ? "–" : `${n.toLocaleString("nb-NO")} kr`);

function Felt({ navn, children }: { navn: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
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

function Dato({ navn, verdi, onChange, paakrevd }: { navn: string; verdi: string | null; onChange: (v: string) => void; paakrevd?: boolean }) {
  return (
    <Felt navn={navn}>
      <input type="date" required={paakrevd} className={INPUT} value={verdi ?? ""} onChange={(e) => onChange(e.target.value)} />
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

function Feilskjema({ f, nr, endre, fjern }: { f: SkjemaFeil; nr: number; endre: (p: Partial<SkjemaFeil>) => void; fjern?: () => void }) {
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
      <Tekst navn="Feilen er at …" verdi={f.en_setning} onChange={(v) => endre({ en_setning: v ?? "" })} paakrevd />
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
          {f.rapport_sier.kostnad === "ja" && <Tall navn="Hvor mye? (kr)" verdi={f.kostnad_kr} onChange={(v) => endre({ kostnad_kr: v })} />}
          <Tekst navn="Verkstedet skriver at …" verdi={f.avskrift_verksted} onChange={(v) => endre({ avskrift_verksted: v })} rader={3} />
        </div>
      )}
    </div>
  );
}

const UTFALL_FARGE: Record<string, string> = {
  sterkere: "bg-[#e3efe5] text-[#1f5a2e]",
  lik: "bg-[#ecebe7] text-[#3d4757]",
  svakere: "bg-[#f6e7d3] text-[#7a4a12]",
  utelat: "text-[#8b919a]",
};
const vis = (x: unknown) => (x == null ? "–" : typeof x === "object" ? JSON.stringify(x) : String(x));

function Merke({ children, mork }: { children: React.ReactNode; mork?: boolean }) {
  return <span className={`rounded px-2 py-0.5 text-[12px] font-medium ${mork ? "bg-[#1f3a5f] text-white" : "bg-[#ecebe7] text-[#3d4757]"}`}>{children}</span>;
}

function Feilresultat({ f, tilBrev, stopp }: { f: FeilResultat; tilBrev: boolean; stopp: string | undefined }) {
  const k = f.kandidat;
  return (
    <article className={KORT}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 mr-1 text-[16px] font-semibold">
          {f.feil_id} · {f.kategori_pass2}
        </h3>
        {tilBrev && <Merke mork>Valgt til brev</Merke>}
        {f.spor_alle.map((s) => (
          <Merke key={s}>
            Spor {s}
            {s === "A" && f.a_variant ? ` (${f.a_variant})` : ""}
            {s === f.spor_primar ? " · primær" : s === f.spor_sekundar ? " · sekundær" : ""}
          </Merke>
        ))}
      </header>
      <p className="m-0 text-[13px] text-[#5b6472]">
        {f.dager_til_feil} dager til feil ({f.innen_frist ? "innen" : "utenfor"} formodningsfristen) · {f.slitedel ? "slitedel" : "ikke slitedel"} · kan brukes: {f.kan_bilen_brukes}
        {f.ingen_spor_arsak && ` · ingen spor: ${f.ingen_spor_arsak}`}
        {` · styrke: ${f.styrke}`}
        {f.forlik && " · forlik (ikke i brevet)"}
        {f.reklamasjon_over_to_mnd && " · reklamert etter to måneder"}
      </p>

      {f.avsnitt ? (
        <p className="m-0 font-brev text-[16px] leading-[1.65] text-[#17263d]">{f.avsnitt}</p>
      ) : (
        <p className="m-0 rounded bg-[#f6e7d3] px-3 py-2 text-[14px] text-[#7a4a12]">Ingen avsnitt: {stopp ?? "ingen godkjent kandidat"}</p>
      )}
      {f.motstridende && (
        <p className="m-0 text-[13px] text-[#3d4757]">
          Tapt med lignende fakta:{" "}
          <a href={f.motstridende.kilde_url} target="_blank" rel="noreferrer" className="text-[#1f3a5f] underline">
            {f.motstridende.saksnummer}
          </a>{" "}
          ({f.motstridende.grunn ?? "–"}). {f.motstridende.skilte.join(" ")}
        </p>
      )}
      {f.naermeste && (
        <p className="m-0 text-[13px] text-[#3d4757]">
          Nærmeste vinnende:{" "}
          <a href={f.naermeste.kilde_url} target="_blank" rel="noreferrer" className="text-[#1f3a5f] underline">
            {f.naermeste.saksnummer}
          </a>{" "}
          ({f.naermeste.vedtaksdato}) · {f.naermeste.kategori} · spor {f.naermeste.spor} · mangler: {f.naermeste.mangler.join(", ")}
        </p>
      )}

      {k && (
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-[#5b6472]">Vedtak</dt>
          <dd className="m-0">
            <a href={k.kilde_url} target="_blank" rel="noreferrer" className="text-[#1f3a5f] underline">
              {k.saksnummer}
            </a>{" "}
            ({k.vedtaksdato}) · feil {k.feil_id} · {k.kategori}
          </dd>
          <dt className="text-[#5b6472]">Hentet på</dt>
          <dd className="m-0">
            spor {f.kandidat_spor} · vunnet på {k.spor_vunnet.join(", ")} · {k.lovversjon}
          </dd>
          <dt className="text-[#5b6472]">Resultat</dt>
          <dd className="m-0">
            {k.sanksjon ?? "–"} · tilkjent {kr(k.tilkjent_totalt_nok)}
          </dd>
          <dt className="text-[#5b6472]">Sterkere</dt>
          <dd className="m-0">
            {f.antall_sterkere} · svakhet adressert: {f.svakhet_adressert ?? "ingen"} · km-svakhet i avsnitt: {f.km_svakhet_i_avsnitt ? "ja" : "nei"}
          </dd>
        </dl>
      )}

      {f.kriterier.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] font-medium text-[#1f3a5f]">Kriterier ({f.kriterier.length})</summary>
          <table className="mt-2 w-full text-left text-[13px]">
            <thead className="text-[#5b6472]">
              <tr>
                <th className="py-1 pr-3 font-medium">Kriterium</th>
                <th className="py-1 pr-3 font-medium">Bruker</th>
                <th className="py-1 pr-3 font-medium">Vedtak</th>
                <th className="py-1 font-medium">Utfall</th>
              </tr>
            </thead>
            <tbody>
              {f.kriterier.map((c) => (
                <tr key={c.navn} className="border-t border-[#ecebe7] align-top">
                  <td className="py-1 pr-3">{c.navn}</td>
                  <td className="py-1 pr-3 break-all">{vis(c.bruker)}</td>
                  <td className="py-1 pr-3 break-all">{vis(c.vedtak)}</td>
                  <td className="py-1">
                    <span className={`rounded px-1.5 py-0.5 ${UTFALL_FARGE[c.utfall]}`}>{c.utfall}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {f.forkastede.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] font-medium text-[#1f3a5f]">Forkastede kandidater ({f.forkastede.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4 text-[13px]">
            {f.forkastede.map((x, i) => (
              <li key={i}>
                <span className="font-medium">{x.saksnummer}</span>: {x.grunn}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Resultatvisning({ r }: { r: Resultat }) {
  if (r.stopp) return <p className="m-0 rounded bg-[#f6e7d3] px-4 py-3 text-[15px] text-[#7a4a12]">Motoren stoppet før matching: privat selger.</p>;
  const stopp = new Map(r.ingen_treff.map((x) => [x.feil_id, x.siste_stopp]));
  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-[#dcd8cf] bg-white/60 p-4 text-[13px] sm:grid-cols-4">
        {Object.entries(r.sak).map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-[#5b6472]">{k}</dt>
            <dd className="m-0 font-medium">{vis(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[14px] text-[#3d4757]">Valgt til brev: {r.valgt_til_brev.length ? r.valgt_til_brev.join(", ") : "ingen"}</p>
      {r.feil.map((f) => (
        <Feilresultat key={f.feil_id} f={f} tilBrev={r.valgt_til_brev.includes(f.feil_id)} stopp={stopp.get(f.feil_id)} />
      ))}
      {r.lovendring && (
        <div className={KORT}>
          <span className={ETIKETT}>Lovendring (etter siste praksisavsnitt)</span>
          <p className="m-0 font-brev text-[16px] leading-[1.65]">{r.lovendring}</p>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-[13px] font-medium text-[#1f3a5f]">Hele resultatet som JSON</summary>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded bg-[#17263d] p-3 font-mono text-[12px] text-[#e8e5de]">{JSON.stringify(r, null, 2)}</pre>
      </details>
    </div>
  );
}

export function Vurderingsskjema({ eksempler }: { eksempler: Eksempel[] }) {
  const [s, setS] = useState<Skjema>(TOMT);
  const [idag, setIdag] = useState(() => new Date().toISOString().slice(0, 10));
  const [svar, setSvar] = useState<Svar | null>(null);
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

  const endreFeil = (i: number) => (p: Partial<SkjemaFeil>) => setS((x) => ({ ...x, del3_feil: x.del3_feil.map((f, j) => (j === i ? { ...f, ...p } : f)) }));
  const lastEksempel = (id: string) => {
    const e = eksempler.find((x) => x.id === id);
    setS(e ? structuredClone(e.skjema) : TOMT);
    setSvar(null);
  };
  // Render must be deterministic (hydration); the real timestamp is set on submit.
  const sendes = tilMotor(s, `${idag}T00:00:00.000Z`);
  const valideringsfeil = validerSkjema(sendes, idag);

  return (
    <div className="min-h-screen bg-[#f6f4ef] font-ui text-[#17263d]">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 lg:grid-cols-2 lg:px-8">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setSvar(await vurder(tilMotor(s, new Date().toISOString()), idag)));
          }}
        >
          <header className="flex flex-col gap-3">
            <h1 className="m-0 font-brev text-[30px] font-semibold">Vurdering</h1>
            <p className="m-0 text-[14px] text-[#5b6472]">
              Testskjema for sammenligningsmotoren (skjema v{SKJEMA_VERSJON}, docs/skjema.md). Gir ett praksisavsnitt per feil fra vedtakene i databasen.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Felt navn="Last eksempel">
                <select className={INPUT} defaultValue="" onChange={(e) => lastEksempel(e.target.value)}>
                  <option value="">Tomt skjema</option>
                  {eksempler.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.navn}
                    </option>
                  ))}
                </select>
              </Felt>
              <Dato navn="Dagens dato (for motoren)" verdi={idag} onChange={setIdag} />
            </div>
          </header>

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
                <Felt navn="Hva heter firmaet du kjøpte av?">
                  <input className={INPUT} value={s.del2_selger.firmanavn_oppgitt ?? ""} onChange={(e) => del("del2_selger")({ firmanavn_oppgitt: e.target.value || null })} />
                </Felt>
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
              </section>
            </>
          )}

          {valideringsfeil.length > 0 && (
            <div className="rounded border border-[#e8c9a0] bg-[#fbf3e8] px-4 py-3 text-[13px] text-[#7a4a12]">
              <p className="m-0 font-medium">Skjemaet består ikke valideringen (motoren kjøres likevel):</p>
              <ul className="m-0 mt-1 pl-4">
                {valideringsfeil.map((v, i) => (
                  <li key={i}>
                    {v.felt}: {v.melding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" disabled={venter} className="sticky bottom-4 rounded bg-[#1f3a5f] px-5 py-3 text-[16px] font-semibold text-white shadow-lg disabled:opacity-60">
            {venter ? "Vurderer …" : "Kjør vurdering"}
          </button>

          <details>
            <summary className="cursor-pointer text-[13px] font-medium text-[#1f3a5f]">Skjemaet som sendes, som JSON</summary>
            <pre className="mt-2 max-h-[480px] overflow-auto rounded bg-[#17263d] p-3 font-mono text-[12px] text-[#e8e5de]">{JSON.stringify(sendes, null, 2)}</pre>
          </details>
        </form>

        <section aria-live="polite" className="flex flex-col gap-4 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-auto lg:py-2">
          <h2 className="m-0 font-brev text-[24px] font-semibold">Avsnitt per feil</h2>
          {!svar && <p className="m-0 text-[14px] text-[#5b6472]">Fyll ut skjemaet og trykk «Kjør vurdering».</p>}
          {svar && !svar.ok && <p className="m-0 rounded bg-[#f6dcd7] px-4 py-3 text-[14px] text-[#8a3b2e]">Feil fra motoren: {svar.feil}</p>}
          {svar?.ok && <Resultatvisning r={svar.resultat} />}
        </section>
      </div>
    </div>
  );
}
