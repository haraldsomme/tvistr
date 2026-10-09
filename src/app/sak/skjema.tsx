"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Logo } from "@/app/logo";
import { HVOR_STO_DET, KATEGORIER, MAKS_FEIL, type Valideringsfeil, validerSkjema } from "@/lib/skjema/skjema";
import { byggSkjema, type FeilUtkast, fjernFeil, idagINorge, STUBB_AVTALE, STUBB_FEIL, STUBB_VERKSTED, tomFeil, tomtUtkast, type Utkast, vises } from "@/lib/skjema/utkast";
import { type SakSvar, sendSak } from "./actions";
import { Avkrysning, Flervalg, Fritekst, Merknad, Sporsmal, Stubb, Tekst, Valg } from "./felt";
import { Forhandlervelger } from "./forhandler";
import { Resultat } from "./resultat";

const JA_NEI = [
  { verdi: "ja", tekst: "Ja" },
  { verdi: "nei", tekst: "Nei" },
];
const RAPPORTSVAR = [
  { verdi: "ja", tekst: "Ja" },
  { verdi: "nei", tekst: "Nei" },
  { verdi: "star_ikke", tekst: "Står ikke" },
];

type Steg = { navn: string; prefiks: string[]; feil?: number };

// The steps follow docs/skjema.md § 2; each defect is a step of its own (parts 3–5).
function stegFor(u: Utkast): Steg[] {
  return [
    { navn: "Kjøpet", prefiks: ["del1_kjopet"] },
    { navn: "Selger", prefiks: ["del2_selger"] },
    ...u.feil.map((_, i) => ({ navn: u.feil.length > 1 ? `Feil ${i + 1}` : "Feilen", prefiks: [`del3_feil[${i}]`], feil: i })),
    { navn: "Kontakt med selger", prefiks: ["km_na", "del6_kontakt_med_selger"] },
    { navn: "Ønske og kontakt", prefiks: ["del7_onske_og_kontakt"] },
    { navn: "Send", prefiks: ["bekreftelser", "_meta"] },
  ];
}

export function Sakskjema() {
  const [u, setU] = useState<Utkast>(tomtUtkast);
  const [steg, setSteg] = useState(0);
  const [visFeil, setVisFeil] = useState(false);
  const [svar, setSvar] = useState<SakSvar | null>(null);
  const [sendes, startSending] = useTransition();
  const idag = idagINorge();

  const alleSteg = stegFor(u);
  const navarende = alleSteg[steg];
  const skjema = useMemo(() => byggSkjema(u, new Date().toISOString()), [u]);
  const alleFeil = useMemo(() => validerSkjema(skjema, idag), [skjema, idag]);
  const stegFeil = (s: Steg) => alleFeil.filter((f) => s.prefiks.some((p) => f.felt === p || f.felt.startsWith(`${p}.`)));
  const feilHer = stegFeil(navarende);
  const feilFor = (felt: string) => (visFeil ? feilHer.find((f) => f.felt === felt || f.felt.startsWith(`${felt}.`))?.melding : undefined);

  const sett = (endring: Partial<Utkast>) => setU((x) => ({ ...x, ...endring }));
  const settFeil = (i: number, endring: Partial<FeilUtkast>) => setU((x) => ({ ...x, feil: x.feil.map((f, j) => (j === i ? { ...f, ...endring } : f)) }));

  const ga = (til: number) => {
    setVisFeil(false);
    setSteg(til);
    window.scrollTo({ top: 0 });
  };
  const neste = () => {
    if (feilHer.length) {
      setVisFeil(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    ga(steg + 1);
  };
  const send = () => {
    if (alleFeil.length) {
      setVisFeil(true);
      return;
    }
    startSending(async () => setSvar(await sendSak(byggSkjema(u, new Date().toISOString()))));
  };

  if (svar?.ok) return <Ramme><Resultat svar={svar} skjema={skjema} /></Ramme>;

  const privat = u.selgertype === "privat";
  const sisteSteg = steg === alleSteg.length - 1;

  return (
    <Ramme>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1f3a5f]">
          Steg {steg + 1} av {alleSteg.length}
        </span>
        <h1 className="m-0 font-brev text-[30px] font-semibold leading-[1.15] md:text-[36px]">{navarende.navn}</h1>
        <div className="mt-2 flex gap-1" aria-hidden>
          {alleSteg.map((s, i) => (
            <span key={s.navn} className={`h-1 flex-1 rounded-full ${i <= steg ? "bg-[#1f3a5f]" : "bg-[#dcd8cf]"}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {steg === 0 && <Kjopet u={u} sett={sett} feilFor={feilFor} idag={idag} />}
        {steg === 1 && <Selger u={u} sett={sett} feilFor={feilFor} />}
        {navarende.feil != null && (
          <Feilen
            i={navarende.feil}
            f={u.feil[navarende.feil]}
            u={u}
            sett={(e) => settFeil(navarende.feil!, e)}
            feilFor={(felt) => feilFor(`del3_feil[${navarende.feil}].${felt}`)}
            idag={idag}
          />
        )}
        {navarende.navn === "Kontakt med selger" && <Kontakt u={u} sett={sett} feilFor={feilFor} idag={idag} />}
        {navarende.navn === "Ønske og kontakt" && <Onske u={u} sett={sett} feilFor={feilFor} />}
        {sisteSteg && <Bekreft u={u} sett={sett} feilFor={feilFor} alleFeil={visFeil ? alleFeil : []} alleSteg={alleSteg} stegFeil={stegFeil} ga={ga} />}
      </div>

      {navarende.feil != null && navarende.feil === u.feil.length - 1 && (
        <div className="flex flex-col gap-3 border-t border-[#dcd8cf] pt-6">
          {u.feil.length < MAKS_FEIL && (
            <button
              type="button"
              onClick={() => (feilHer.length ? neste() : (sett({ feil: [...u.feil, tomFeil()] }), ga(steg + 1)))}
              className="self-start rounded-[6px] border border-[#1f3a5f] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#1f3a5f]"
            >
              + Meld en feil til
            </button>
          )}
          {u.feil.length > 1 && (
            <button
              type="button"
              onClick={() => (sett(fjernFeil(u, navarende.feil!)), ga(steg - 1))}
              className="self-start text-[15px] text-[#a3372b] underline underline-offset-2"
            >
              Fjern denne feilen
            </button>
          )}
        </div>
      )}

      {svar && !svar.ok && (
        <p role="alert" className="m-0 text-[15px] font-medium text-[#a3372b]">
          {"melding" in svar ? svar.melding : `Svarene ble ikke godtatt: ${svar.feil.map((f) => `${f.felt} ${f.melding}`).join("; ")}`}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[#dcd8cf] pt-6">
        {steg > 0 ? (
          <button type="button" onClick={() => ga(steg - 1)} className="rounded-[6px] px-2 py-3 text-[16px] font-medium text-[#1f3a5f]">
            ← Tilbake
          </button>
        ) : (
          <span />
        )}
        {!privat && !sisteSteg && (
          <button type="button" onClick={neste} className="rounded-[6px] bg-[#17263d] px-7 py-3.5 text-[16px] font-semibold text-[#f6f4ef]">
            Neste
          </button>
        )}
        {sisteSteg && (
          <button type="button" onClick={send} disabled={sendes} className="rounded-[6px] bg-[#17263d] px-7 py-3.5 text-[16px] font-semibold text-[#f6f4ef] disabled:opacity-60">
            {sendes ? "Vurderer …" : "Se vurderingen"}
          </button>
        )}
      </div>
    </Ramme>
  );
}

function Ramme({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f4ef] font-ui text-[#17263d]">
      <header className="border-b border-[#dcd8cf] px-4 py-[18px] md:px-16">
        <Link href="/" aria-label="Til forsiden">
          <Logo liten />
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8 px-4 pb-16 pt-8 md:pt-12">{children}</div>
    </div>
  );
}

type Del = { u: Utkast; sett: (e: Partial<Utkast>) => void; feilFor: (felt: string) => string | undefined };

function Kjopet({ u, sett, feilFor, idag }: Del & { idag: string }) {
  return (
    <>
      <Sporsmal tittel="Kjøpte du bilen av et firma (forhandler) eller en privatperson?" feil={feilFor("del1_kjopet.selgertype")}>
        <Valg
          navn="selgertype"
          verdi={u.selgertype}
          onChange={(v) => sett({ selgertype: v })}
          alternativer={[
            { verdi: "forhandler", tekst: "Et firma (forhandler)" },
            { verdi: "privat", tekst: "En privatperson" },
          ]}
        />
      </Sporsmal>
      {u.selgertype === "privat" ? (
        <Merknad>
          Ved kjøp fra en privatperson gjelder kjøpsloven, ikke forbrukerkjøpsloven. Tjenesten dekker foreløpig bare kjøp fra forhandler, så vi kan dessverre ikke hjelpe deg med denne
          saken.
        </Merknad>
      ) : (
        <>
          <Sporsmal tittel="Når kjøpte du bilen?" feil={feilFor("del1_kjopet.kjopsdato")}>
            <Tekst type="date" verdi={u.kjopsdato} onChange={(v) => sett({ kjopsdato: v })} etikett="Kjøpsdato" min="2010-01-01" max={idag} bredde="w-[200px]" />
          </Sporsmal>
          <Sporsmal tittel="Hva betalte du?" feil={feilFor("del1_kjopet.pris_kr")}>
            <Tekst verdi={u.pris_kr} onChange={(v) => sett({ pris_kr: v })} etikett="Pris" inputMode="numeric" etter="kr" bredde="w-[200px]" />
          </Sporsmal>
          <Sporsmal tittel="Hva var kilometerstanden ved kjøp?" feil={feilFor("del1_kjopet.km_ved_kjop")}>
            <Tekst verdi={u.km_ved_kjop} onChange={(v) => sett({ km_ved_kjop: v })} etikett="Kilometerstand ved kjøp" inputMode="numeric" etter="km" bredde="w-[200px]" />
          </Sporsmal>
          <Sporsmal tittel="Hvilken årsmodell er bilen?" feil={feilFor("del1_kjopet.aarsmodell")}>
            <Tekst verdi={u.aarsmodell} onChange={(v) => sett({ aarsmodell: v })} etikett="Årsmodell" inputMode="numeric" maxLength={4} bredde="w-[120px]" />
          </Sporsmal>
          <Sporsmal tittel="Merke og modell (valgfritt)" feil={feilFor("del1_kjopet.merke_modell_valgfritt")}>
            <Tekst verdi={u.merke_modell} onChange={(v) => sett({ merke_modell: v })} etikett="Merke og modell" maxLength={60} placeholder="For eksempel Skoda Enyaq iV 80" />
          </Sporsmal>
        </>
      )}
    </>
  );
}

function Selger({ u, sett, feilFor }: Del) {
  return (
    <>
      <Sporsmal tittel="Hva heter firmaet du kjøpte av?" feil={feilFor("del2_selger.firmanavn_oppgitt") ?? feilFor("del2_selger.bronnoysund_treff")}>
        <Forhandlervelger
          navn={u.firmanavn}
          treff={u.treff}
          bekreftet={u.treff_bekreftet}
          onNavn={(v) => sett({ firmanavn: v })}
          onTreff={(t, b) => sett({ treff: t, treff_bekreftet: b })}
        />
      </Sporsmal>
      <Sporsmal tittel="Sto det «som den er», «som forevist» eller lignende i kontrakten?" feil={feilFor("del2_selger.som_den_er_i_kontrakt")}>
        <Valg
          navn="som_den_er"
          verdi={u.som_den_er}
          onChange={(v) => sett({ som_den_er: v })}
          alternativer={[
            { verdi: "ja", tekst: "Ja" },
            { verdi: "nei", tekst: "Nei" },
            { verdi: "vet_ikke", tekst: "Vet ikke" },
          ]}
        />
      </Sporsmal>
    </>
  );
}

function Feilen({
  i,
  f,
  u,
  sett,
  feilFor,
  idag,
}: {
  i: number;
  f: FeilUtkast;
  u: Utkast;
  sett: (e: Partial<FeilUtkast>) => void;
  feilFor: (felt: string) => string | undefined;
  idag: string;
}) {
  const n = `f${i}`;
  return (
    <>
      <Sporsmal tittel="Hva slags feil er det?" feil={feilFor("kategori")}>
        <select
          aria-label="Type feil"
          value={f.kategori}
          onChange={(e) => sett({ kategori: e.target.value })}
          className="w-full rounded-[6px] border border-[#cfcac0] bg-white px-3.5 py-3 text-[16px] text-[#17263d] outline-none focus:border-[#1f3a5f] focus:ring-2 focus:ring-[#1f3a5f]/20"
        >
          <option value="">Velg …</option>
          {KATEGORIER.map((k) => (
            <option key={k.nokkel} value={k.nokkel}>
              {k.navn}
            </option>
          ))}
        </select>
      </Sporsmal>
      <Sporsmal tittel="Hva er feilen?" hjelp="Én setning. Skriv hva som skjer, ikke hva du tror årsaken er." feil={feilFor("en_setning")}>
        <Stubb stubb={STUBB_FEIL} verdi={f.en_setning} onChange={(v) => sett({ en_setning: v })} maks={220} rader={2} />
      </Sporsmal>
      <Sporsmal tittel="Når oppdaget du feilen?" feil={feilFor("dato_oppdaget")}>
        <Tekst type="date" verdi={f.dato_oppdaget} onChange={(v) => sett({ dato_oppdaget: v })} etikett="Dato oppdaget" min={u.kjopsdato} max={idag} bredde="w-[200px]" />
      </Sporsmal>
      <Sporsmal tittel="Kan bilen brukes?" feil={feilFor("kan_bilen_brukes")}>
        <Valg
          navn={`${n}-brukes`}
          verdi={f.kan_bilen_brukes}
          onChange={(v) => sett({ kan_bilen_brukes: v })}
          alternativer={[
            { verdi: "ja", tekst: "Ja" },
            { verdi: "ja_begrenset", tekst: "Ja, men begrenset" },
            { verdi: "nei", tekst: "Nei" },
          ]}
        />
      </Sporsmal>

      <h2 className="m-0 border-t border-[#dcd8cf] pt-8 font-brev text-[22px] font-semibold">Hva selger sa</h2>
      <Sporsmal tittel="Sa eller skrev selger noe om dette før kjøpet?" feil={feilFor("selger_sa_noe")}>
        <Valg
          navn={`${n}-sa`}
          verdi={f.selger_sa_noe}
          onChange={(v) => sett({ selger_sa_noe: v })}
          alternativer={[
            { verdi: "nei", tekst: "Nei" },
            { verdi: "ja_skriftlig", tekst: "Ja, skriftlig", forklaring: "I annonsen, kontrakten, en melding eller lignende" },
            { verdi: "ja_muntlig", tekst: "Ja, men bare muntlig" },
          ]}
        />
      </Sporsmal>
      {f.selger_sa_noe === "ja_muntlig" && (
        <Merknad>Muntlige løfter er vanskelige å bevise og teller sjelden alene. Vi tar det med i beskrivelsen, men bygger ikke kravet på det.</Merknad>
      )}
      {vises.hvorStoDet(f) && (
        <>
          <Sporsmal tittel="Hvor sto det?" hjelp="Velg alle som passer." feil={feilFor("hvor_sto_det")}>
            <Flervalg verdier={f.hvor_sto_det} onChange={(v) => sett({ hvor_sto_det: v })} alternativer={HVOR_STO_DET.map((h) => ({ verdi: h.nokkel, tekst: h.navn }))} />
          </Sporsmal>
          <Sporsmal tittel="Skriv av det som sto, så nøyaktig du kan" hjelp="Kopier ordene slik de sto i annonsen, kontrakten eller meldingen. Ikke omskriv." feil={feilFor("avskrift_selger")}>
            <Fritekst verdi={f.avskrift_selger} onChange={(v) => sett({ avskrift_selger: v })} etikett="Det selger skrev" maks={500} />
          </Sporsmal>
          {vises.direkteSporsmal(f) && (
            <Sporsmal tittel="Var meldingen svar på et spørsmål du stilte selger?" feil={feilFor("svar_pa_direkte_sporsmal")}>
              <Valg navn={`${n}-direkte`} verdi={f.svar_pa_direkte_sporsmal} onChange={(v) => sett({ svar_pa_direkte_sporsmal: v })} alternativer={JA_NEI} />
            </Sporsmal>
          )}
        </>
      )}

      <h2 className="m-0 border-t border-[#dcd8cf] pt-8 font-brev text-[22px] font-semibold">Verkstedet</h2>
      <Sporsmal tittel="Har et verksted sett på feilen?" feil={feilFor("verksted_sett_pa")}>
        <Valg
          navn={`${n}-verksted`}
          verdi={f.verksted_sett_pa}
          onChange={(v) => sett({ verksted_sett_pa: v })}
          alternativer={[
            { verdi: "nei", tekst: "Nei" },
            { verdi: "ja_skriftlig", tekst: "Ja, og jeg har det skriftlig", forklaring: "Rapport, faktura, arbeidsordre eller e-post fra verkstedet" },
            { verdi: "ja_muntlig", tekst: "Ja, men bare muntlig" },
          ]}
        />
      </Sporsmal>
      {(f.verksted_sett_pa === "nei" || f.verksted_sett_pa === "ja_muntlig") && (
        <Merknad>Sammen med brevet får du et ark til verkstedet med det rapporten bør si. En skriftlig rapport gjør saken din mye sterkere.</Merknad>
      )}
      {vises.rapport(f) && (
        <>
          <Sporsmal tittel="Hvilket verksted, og når?" feil={feilFor("verksted_navn_dato")}>
            <Tekst verdi={f.verksted_navn_dato} onChange={(v) => sett({ verksted_navn_dato: v })} etikett="Verksted og dato" placeholder="For eksempel Skoda Haugesund AS, 04.12.2025" />
          </Sporsmal>
          <Merknad>Svar ut fra det som faktisk står i rapporten. «Står ikke» er et vanlig svar – da forteller vi deg hva du bør be verkstedet legge til.</Merknad>
          <Sporsmal tittel="Står det hvilken del som er feil?" hjelp="En faktura eller en diagnoseutskrift som nevner delen, holder." feil={feilFor("rapport_sier.hva")}>
            <Valg navn={`${n}-hva`} verdi={f.rapport_sier.hva} onChange={(v) => sett({ rapport_sier: { ...f.rapport_sier, hva: v } })} alternativer={RAPPORTSVAR} />
          </Sporsmal>
          <Sporsmal tittel="Står det hvorfor den sviktet (årsak)?" feil={feilFor("rapport_sier.hvorfor")}>
            <Valg navn={`${n}-hvorfor`} verdi={f.rapport_sier.hvorfor} onChange={(v) => sett({ rapport_sier: { ...f.rapport_sier, hvorfor: v } })} alternativer={RAPPORTSVAR} />
          </Sporsmal>
          <Sporsmal tittel="Står det at feilen sannsynligvis var der da du overtok bilen?" feil={feilFor("rapport_sier.var_der_ved_overtakelse")}>
            <Valg
              navn={`${n}-overtakelse`}
              verdi={f.rapport_sier.var_der_ved_overtakelse}
              onChange={(v) => sett({ rapport_sier: { ...f.rapport_sier, var_der_ved_overtakelse: v } })}
              alternativer={RAPPORTSVAR}
            />
          </Sporsmal>
          <Sporsmal tittel="Står det at feilen er mer enn normal slitasje for bilens alder og kjørelengde?" feil={feilFor("rapport_sier.mer_enn_normal_slitasje")}>
            <Valg
              navn={`${n}-slitasje`}
              verdi={f.rapport_sier.mer_enn_normal_slitasje}
              onChange={(v) => sett({ rapport_sier: { ...f.rapport_sier, mer_enn_normal_slitasje: v } })}
              alternativer={RAPPORTSVAR}
            />
          </Sporsmal>
          <Sporsmal tittel="Står det hva reparasjonen koster?" feil={feilFor("rapport_sier.kostnad")}>
            <Valg navn={`${n}-kostnad`} verdi={f.rapport_sier.kostnad} onChange={(v) => sett({ rapport_sier: { ...f.rapport_sier, kostnad: v } })} alternativer={RAPPORTSVAR} />
          </Sporsmal>
          {vises.kostnad(f) && (
            <Sporsmal tittel="Hvor mye?" feil={feilFor("kostnad_kr")}>
              <Tekst verdi={f.kostnad_kr} onChange={(v) => sett({ kostnad_kr: v })} etikett="Kostnad" inputMode="numeric" etter="kr" bredde="w-[200px]" />
            </Sporsmal>
          )}
          <Sporsmal tittel="Hva skriver verkstedet?" hjelp="Skriv av verkstedets konklusjon, gjerne den setningen som sier hva som er feil og hvorfor." feil={feilFor("avskrift_verksted")}>
            <Stubb stubb={STUBB_VERKSTED} verdi={f.avskrift_verksted} onChange={(v) => sett({ avskrift_verksted: v })} maks={620} />
          </Sporsmal>
        </>
      )}
    </>
  );
}

function Kontakt({ u, sett, feilFor, idag }: Del & { idag: string }) {
  const tidligst = u.feil.map((f) => f.dato_oppdaget).filter(Boolean).sort()[0];
  return (
    <>
      <Sporsmal tittel="Hva er kilometerstanden nå?" feil={feilFor("km_na")}>
        <Tekst verdi={u.km_na} onChange={(v) => sett({ km_na: v })} etikett="Kilometerstand nå" inputMode="numeric" etter="km" bredde="w-[200px]" />
      </Sporsmal>
      <Sporsmal tittel="Har du tatt dette opp med selger?" feil={feilFor("del6_kontakt_med_selger.tatt_opp_med_selger")}>
        <Valg
          navn="tatt_opp"
          verdi={u.tatt_opp}
          onChange={(v) => sett({ tatt_opp: v })}
          alternativer={[
            { verdi: "nei", tekst: "Nei, ikke ennå" },
            { verdi: "ja_muntlig", tekst: "Ja, muntlig" },
            { verdi: "ja_skriftlig", tekst: "Ja, skriftlig" },
          ]}
        />
      </Sporsmal>
      {vises.kontakt(u) && (
        <>
          <Sporsmal tittel="Når tok du det opp første gang?" feil={feilFor("del6_kontakt_med_selger.dato_forste_gang")}>
            <Tekst type="date" verdi={u.dato_forste_gang} onChange={(v) => sett({ dato_forste_gang: v })} etikett="Første kontakt" min={tidligst} max={idag} bredde="w-[200px]" />
          </Sporsmal>
          <Sporsmal tittel="Hva svarte selger?" feil={feilFor("del6_kontakt_med_selger.selgers_svar")}>
            <Valg
              navn="selgers_svar"
              verdi={u.selgers_svar}
              onChange={(v) => sett({ selgers_svar: v })}
              alternativer={[
                { verdi: "ikke_svart", tekst: "Selger har ikke svart" },
                { verdi: "avvist", tekst: "Selger avviste kravet" },
                { verdi: "tilbudt_reparasjon", tekst: "Selger tilbød å reparere" },
                { verdi: "tilbudt_delvis", tekst: "Selger tilbød å dekke en del" },
                { verdi: "enige_om_noe", tekst: "Vi ble enige om noe" },
              ]}
            />
          </Sporsmal>
        </>
      )}
      {vises.avtale(u) && (
        <>
          <Sporsmal tittel="Har dere inngått en avtale eller et forlik?" feil={feilFor("del6_kontakt_med_selger.avtale_inngatt")}>
            <Valg navn="avtale" verdi={u.avtale_inngatt} onChange={(v) => sett({ avtale_inngatt: v })} alternativer={JA_NEI} />
          </Sporsmal>
          {u.avtale_inngatt === "ja" && (
            <>
              <Sporsmal tittel="Hva går avtalen ut på?" feil={feilFor("del6_kontakt_med_selger.avtale_beskrivelse")}>
                <Stubb stubb={STUBB_AVTALE} verdi={u.avtale_beskrivelse} onChange={(v) => sett({ avtale_beskrivelse: v })} maks={500} />
              </Sporsmal>
              <Sporsmal
                tittel="Hvilke av feilene gjelder avtalen?"
                hjelp="Feilene avtalen gjelder, tar vi ikke med i kravet. De andre tar vi med som vanlig."
                feil={feilFor("del6_kontakt_med_selger.avtale_gjelder_feil")}
              >
                <Flervalg
                  verdier={u.avtale_gjelder_feil}
                  onChange={(v) => sett({ avtale_gjelder_feil: v })}
                  alternativer={u.feil.map((f, i) => ({ verdi: `F${i + 1}`, tekst: `Feil ${i + 1}: ${f.en_setning.trim() || "(ikke beskrevet)"}` }))}
                />
              </Sporsmal>
            </>
          )}
        </>
      )}
      {vises.dokumentasjon(u) && (
        <>
          <Sporsmal
            tittel="La selger frem noen dokumentasjon, for eksempel en rapport eller verkstedhistorikk?"
            hjelp="Dette er viktig. Har selger vist til en egen rapport eller verkstedhistorikk, må brevet svare på den."
            feil={feilFor("del6_kontakt_med_selger.selger_la_frem_dokumentasjon")}
          >
            <Valg navn="dokumentasjon" verdi={u.selger_la_frem} onChange={(v) => sett({ selger_la_frem: v })} alternativer={JA_NEI} />
          </Sporsmal>
          {u.selger_la_frem === "ja" && (
            <Sporsmal tittel="Hva slags dokumentasjon?" feil={feilFor("del6_kontakt_med_selger.selger_dokumentasjon_kort")}>
              <Fritekst verdi={u.selger_dokumentasjon} onChange={(v) => sett({ selger_dokumentasjon: v })} etikett="Selgers dokumentasjon" maks={200} rader={2} />
            </Sporsmal>
          )}
        </>
      )}
    </>
  );
}

function Onske({ u, sett, feilFor }: Del) {
  return (
    <>
      <Sporsmal tittel="Hva ønsker du?" feil={feilFor("del7_onske_og_kontakt.onsket_losning")}>
        <Valg
          navn="onske"
          verdi={u.onsket_losning}
          onChange={(v) => sett({ onsket_losning: v })}
          alternativer={[
            { verdi: "reparasjon", tekst: "At selger reparerer feilen" },
            { verdi: "prisavslag", tekst: "Prisavslag" },
            { verdi: "angre_kjopet", tekst: "Å gå fra kjøpet" },
          ]}
        />
      </Sporsmal>
      {u.onsket_losning === "angre_kjopet" && <Merknad>Å gå fra kjøpet krever at feilen er vesentlig. Brevet vil kreve det, men også ta forbehold om prisavslag.</Merknad>}
      <Sporsmal tittel="Navnet ditt" feil={feilFor("del7_onske_og_kontakt.kjoper.navn")}>
        <Tekst verdi={u.navn} onChange={(v) => sett({ navn: v })} etikett="Navn" autoComplete="name" />
      </Sporsmal>
      <Sporsmal tittel="Adressen din" hjelp="Brukes som avsender i brevet." feil={feilFor("del7_onske_og_kontakt.kjoper.adresse")}>
        <Tekst verdi={u.adresse} onChange={(v) => sett({ adresse: v })} etikett="Adresse" autoComplete="street-address" placeholder="Gate 1, 0000 Sted" />
      </Sporsmal>
      <Sporsmal tittel="E-postadressen din" feil={feilFor("del7_onske_og_kontakt.kjoper.epost")}>
        <Tekst type="email" inputMode="email" verdi={u.epost} onChange={(v) => sett({ epost: v })} etikett="E-post" autoComplete="email" />
      </Sporsmal>
    </>
  );
}

function Bekreft({
  u,
  sett,
  feilFor,
  alleFeil,
  alleSteg,
  stegFeil,
  ga,
}: Del & { alleFeil: Valideringsfeil[]; alleSteg: Steg[]; stegFeil: (s: Steg) => Valideringsfeil[]; ga: (i: number) => void }) {
  // Steps that still have unanswered questions, when the buyer jumped back and changed something.
  const ufullstendige = alleFeil.length ? alleSteg.map((s, i) => ({ s, i })).filter(({ s, i }) => i < alleSteg.length - 1 && stegFeil(s).length > 0) : [];
  return (
    <>
      <p className="m-0 text-[16px] leading-[1.6] text-[#3d4757]">Du får en gratis vurdering av saken. Brevet kan du kjøpe etterpå.</p>
      <Avkrysning verdi={u.bekreft_riktig} onChange={(v) => sett({ bekreft_riktig: v })} feil={feilFor("bekreftelser.opplysningene_er_riktige")}>
        Opplysningene jeg har gitt, er riktige så langt jeg vet.
      </Avkrysning>
      <Avkrysning verdi={u.bekreft_ikke_radgivning} onChange={(v) => sett({ bekreft_ikke_radgivning: v })} feil={feilFor("bekreftelser.lest_at_brevet_ikke_er_juridisk_radgivning")}>
        Jeg har lest at brevet ikke er juridisk rådgivning.
      </Avkrysning>
      {ufullstendige.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 text-[15px] text-[#a3372b]">
          <span className="font-medium">Noen svar mangler:</span>
          {ufullstendige.map(({ s, i }) => (
            <button key={s.navn} type="button" onClick={() => ga(i)} className="self-start text-left underline underline-offset-2">
              {s.navn}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
