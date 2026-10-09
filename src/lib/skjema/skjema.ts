// The complaint form (docs/skjema.md, spec v1.0): its JSON, the closed value lists and the
// validation the form and the server both run. The comparison engine reads this structure as is.

export const SKJEMA_VERSJON = "1.1";

// Pass 2's categories (src/lib/analyse/skjema.ts), so the engine needs no mapping.
export const KATEGORIER = [
  { nokkel: "motor", navn: "Motor (også turbo, registerreim, kjøling, oljeforbruk)" },
  { nokkel: "girkasse", navn: "Girkasse" },
  { nokkel: "clutch", navn: "Clutch" },
  { nokkel: "drivlinje", navn: "Firehjulstrekk, drivaksler, differensial" },
  { nokkel: "bremser", navn: "Bremser" },
  { nokkel: "understell_hjuloppheng", navn: "Understell, hjullager, styring, støtdempere" },
  { nokkel: "dekk_felger", navn: "Dekk og felger" },
  { nokkel: "rust", navn: "Rust" },
  { nokkel: "karosseri_lakk_glass", navn: "Lakk, bulker, ruter, speil" },
  { nokkel: "elektrisk", navn: "Elektrisk (lys, sensorer, infotainment, parkeringsvarmer)" },
  { nokkel: "batteri_elbil", navn: "Elbilbatteri og rekkevidde" },
  { nokkel: "klimaanlegg", navn: "Klimaanlegg / AC" },
  { nokkel: "fukt_lekkasje", navn: "Fukt eller vannlekkasje" },
  { nokkel: "eksos_utslipp", navn: "Eksos, partikkelfilter, AdBlue" },
  { nokkel: "utstyr_mangler", navn: "Utstyr som mangler eller ikke er som annonsert" },
  { nokkel: "kollisjonsskade", navn: "Tidligere kollisjonsskade som ikke ble opplyst" },
  { nokkel: "servicehistorikk", navn: "Service ikke utført som opplyst" },
  { nokkel: "km_avvik", navn: "Kilometerstanden stemmer ikke" },
  { nokkel: "bruktimport_opplysning", navn: "Bilen var importert uten at det ble opplyst" },
  { nokkel: "eu_kontroll_registrering", navn: "EU-kontroll, registrering, avgifter" },
  { nokkel: "interior_lukt", navn: "Interiør, seter, lukt" },
  { nokkel: "heftelse_pant", navn: "Pant eller heftelse på bilen" },
  { nokkel: "annet", navn: "Annet" },
] as const;
export type Kategori = (typeof KATEGORIER)[number]["nokkel"];

export const HVOR_STO_DET = [
  { nokkel: "annonse", navn: "Annonsen" },
  { nokkel: "kontrakt", navn: "Kontrakten" },
  { nokkel: "sms_epost_chat", navn: "SMS, e-post eller chat" },
  { nokkel: "salgsoppgave", navn: "Salgsoppgave" },
  { nokkel: "tilstandsrapport_fra_selger", navn: "Tilstandsrapport fra selger" },
] as const;

export const MAKS_FEIL = 3;

export type Rapportsvar = "ja" | "nei" | "star_ikke";
// 16a hva (which part is faulty) and 16a2 hvorfor (why it failed) mirror pass 2's arsak: komponent | rotarsak.
export type RapportSier = { hva: Rapportsvar; hvorfor: Rapportsvar; var_der_ved_overtakelse: Rapportsvar; mer_enn_normal_slitasje: Rapportsvar; kostnad: Rapportsvar };
export const RAPPORT_TOM: RapportSier = { hva: "star_ikke", hvorfor: "star_ikke", var_der_ved_overtakelse: "star_ikke", mer_enn_normal_slitasje: "star_ikke", kostnad: "star_ikke" };

export type SkjemaFeil = {
  id: string;
  kategori: Kategori;
  en_setning: string; // completes «Feilen er at …»
  dato_oppdaget: string;
  kan_bilen_brukes: "ja" | "ja_begrenset" | "nei";
  selger_sa_noe: "nei" | "ja_skriftlig" | "ja_muntlig";
  hvor_sto_det: (typeof HVOR_STO_DET)[number]["nokkel"][];
  avskrift_selger: string | null;
  svar_pa_direkte_sporsmal: boolean;
  verksted_sett_pa: "nei" | "ja_skriftlig" | "ja_muntlig";
  verksted_navn_dato: string | null;
  rapport_sier: RapportSier;
  kostnad_kr: number | null;
  avskrift_verksted: string | null; // completes «Verkstedet skriver at …»
};

export type BrregTreff = { foretaksnavn: string; organisasjonsnummer: string; forretningsadresse: string };

export type Skjema = {
  _meta: { skjema_versjon: string; registrert: string };
  del1_kjopet: { selgertype: "forhandler" | "privat"; kjopsdato: string; pris_kr: number; km_ved_kjop: number; aarsmodell: number; merke_modell_valgfritt: string | null };
  del2_selger: { firmanavn_oppgitt: string | null; bronnoysund_treff: BrregTreff | null; treff_bekreftet: boolean; som_den_er_i_kontrakt: "ja" | "nei" | "vet_ikke" };
  del3_feil: SkjemaFeil[];
  km_na: number;
  del6_kontakt_med_selger: {
    tatt_opp_med_selger: "nei" | "ja_muntlig" | "ja_skriftlig";
    dato_forste_gang: string | null;
    selgers_svar: "ikke_svart" | "avvist" | "tilbudt_reparasjon" | "tilbudt_delvis" | "enige_om_noe" | null;
    avtale_inngatt: "ja" | "nei";
    avtale_beskrivelse: string | null;
    // The defects the agreement covers (del3_feil[].id); only those count as settled (110357).
    avtale_gjelder_feil: string[];
    selger_la_frem_dokumentasjon: "ja" | "nei";
    selger_dokumentasjon_kort: string | null;
  };
  del7_onske_og_kontakt: { onsket_losning: "reparasjon" | "prisavslag" | "angre_kjopet"; kjoper: { navn: string; adresse: string; epost: string } };
  bekreftelser: { opplysningene_er_riktige: boolean; lest_at_brevet_ikke_er_juridisk_radgivning: boolean };
};

// What the buyer typed after a stub («Feilen er at …»), as the letter's templates need it: trimmed,
// without the stub if it was typed anyway, without the closing full stop, and with a lower-case
// first letter unless the text starts with an abbreviation ("AC-anlegget", "EU-kontrollen").
export function stubb(tekst: string, stubbTekst: string): string {
  let s = tekst.trim().replace(/\s+/g, " ");
  if (s.toLowerCase().startsWith(stubbTekst.toLowerCase())) s = s.slice(stubbTekst.length).trim();
  s = s.replace(/^[«"]|[»"]$/g, "").replace(/[.\s]+$/, "");
  return /^[A-ZÆØÅ]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

export type Valideringsfeil = { felt: string; melding: string };

const DATO = /^\d{4}-\d{2}-\d{2}$/;
const gyldigDato = (s: unknown): s is string => typeof s === "string" && DATO.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const heltall = (x: unknown, min: number, maks: number) => Number.isInteger(x) && (x as number) >= min && (x as number) <= maks;
const tekst = (x: unknown, min: number, maks: number) => typeof x === "string" && x.trim().length >= min && x.trim().length <= maks;
const enAv = <T extends string>(x: unknown, verdier: readonly T[]): x is T => typeof x === "string" && (verdier as readonly string[]).includes(x);
const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOKLER = {
  rot: ["_meta", "del1_kjopet", "del2_selger", "del3_feil", "km_na", "del6_kontakt_med_selger", "del7_onske_og_kontakt", "bekreftelser"],
  _meta: ["skjema_versjon", "registrert"],
  del1_kjopet: ["selgertype", "kjopsdato", "pris_kr", "km_ved_kjop", "aarsmodell", "merke_modell_valgfritt"],
  del2_selger: ["firmanavn_oppgitt", "bronnoysund_treff", "treff_bekreftet", "som_den_er_i_kontrakt"],
  feil: [
    "id",
    "kategori",
    "en_setning",
    "dato_oppdaget",
    "kan_bilen_brukes",
    "selger_sa_noe",
    "hvor_sto_det",
    "avskrift_selger",
    "svar_pa_direkte_sporsmal",
    "verksted_sett_pa",
    "verksted_navn_dato",
    "rapport_sier",
    "kostnad_kr",
    "avskrift_verksted",
  ],
  del6_kontakt_med_selger: [
    "tatt_opp_med_selger",
    "dato_forste_gang",
    "selgers_svar",
    "avtale_inngatt",
    "avtale_beskrivelse",
    "avtale_gjelder_feil",
    "selger_la_frem_dokumentasjon",
    "selger_dokumentasjon_kort",
  ],
  del7_onske_og_kontakt: ["onsket_losning", "kjoper"],
  bekreftelser: ["opplysningene_er_riktige", "lest_at_brevet_ikke_er_juridisk_radgivning"],
} as const;

// Every field present, also when null, and nothing else (spec § 7).
function nokler(o: unknown, forventet: readonly string[], sti: string, ut: Valideringsfeil[]): o is Record<string, unknown> {
  if (!o || typeof o !== "object" || Array.isArray(o)) {
    ut.push({ felt: sti, melding: "mangler" });
    return false;
  }
  const har = Object.keys(o);
  for (const k of forventet) if (!har.includes(k)) ut.push({ felt: `${sti}.${k}`, melding: "mangler" });
  for (const k of har) if (!forventet.includes(k)) ut.push({ felt: `${sti}.${k}`, melding: "ukjent felt" });
  return true;
}

// The cross-field rules from spec § 7 plus each field's own. `idag` is the date answers are checked
// against (ÅÅÅÅ-MM-DD). A private sale stops the form after part 1, so only that part is checked.
export function validerSkjema(raa: unknown, idag: string): Valideringsfeil[] {
  const ut: Valideringsfeil[] = [];
  const feil = (felt: string, melding: string) => ut.push({ felt, melding });
  if (!nokler(raa, NOKLER.rot, "skjema", ut)) return ut;
  const s = raa as Record<string, unknown>;

  if (nokler(s._meta, NOKLER._meta, "_meta", ut)) {
    const m = s._meta as Record<string, unknown>;
    if (m.skjema_versjon !== SKJEMA_VERSJON) feil("_meta.skjema_versjon", `ukjent versjon (forventet ${SKJEMA_VERSJON})`);
    if (typeof m.registrert !== "string" || Number.isNaN(Date.parse(m.registrert))) feil("_meta.registrert", "må være et tidspunkt (ISO 8601)");
  }

  if (!nokler(s.del1_kjopet, NOKLER.del1_kjopet, "del1_kjopet", ut)) return ut;
  const k = s.del1_kjopet as Record<string, unknown>;
  if (!enAv(k.selgertype, ["forhandler", "privat"])) feil("del1_kjopet.selgertype", "velg forhandler eller privat");
  if (!gyldigDato(k.kjopsdato) || k.kjopsdato < "2010-01-01" || k.kjopsdato > idag) feil("del1_kjopet.kjopsdato", "må være en dato fra 2010 til i dag");
  if (!heltall(k.pris_kr, 1_000, 3_000_000)) feil("del1_kjopet.pris_kr", "må være mellom 1 000 og 3 000 000 kr");
  if (!heltall(k.km_ved_kjop, 0, 600_000)) feil("del1_kjopet.km_ved_kjop", "må være mellom 0 og 600 000 km");
  const kjopsar = gyldigDato(k.kjopsdato) ? Number(k.kjopsdato.slice(0, 4)) : 2100;
  if (!heltall(k.aarsmodell, 1990, kjopsar)) feil("del1_kjopet.aarsmodell", "må være fra 1990 til kjøpsåret");
  if (k.merke_modell_valgfritt !== null && !tekst(k.merke_modell_valgfritt, 1, 60)) feil("del1_kjopet.merke_modell_valgfritt", "høyst 60 tegn");
  if (k.selgertype === "privat") return ut;

  if (nokler(s.del2_selger, NOKLER.del2_selger, "del2_selger", ut)) {
    const d = s.del2_selger as Record<string, unknown>;
    if (!tekst(d.firmanavn_oppgitt, 1, 120)) feil("del2_selger.firmanavn_oppgitt", "skriv navnet på firmaet");
    const t = d.bronnoysund_treff as Record<string, unknown> | null;
    if (t !== null && (typeof t !== "object" || !tekst(t.foretaksnavn, 1, 200) || !/^\d{9}$/.test(String(t.organisasjonsnummer).replace(/\s/g, ""))))
      feil("del2_selger.bronnoysund_treff", "ugyldig treff");
    if (typeof d.treff_bekreftet !== "boolean") feil("del2_selger.treff_bekreftet", "mangler");
    if (d.treff_bekreftet === true && t === null) feil("del2_selger.treff_bekreftet", "kan ikke bekrefte et treff som mangler");
    if (!enAv(d.som_den_er_i_kontrakt, ["ja", "nei", "vet_ikke"])) feil("del2_selger.som_den_er_i_kontrakt", "velg ja, nei eller vet ikke");
  }

  const liste = Array.isArray(s.del3_feil) ? s.del3_feil : [];
  if (liste.length < 1 || liste.length > MAKS_FEIL) feil("del3_feil", `meld fra én til ${MAKS_FEIL} feil`);
  liste.forEach((f, i) => validerFeil(f, i, k.kjopsdato as string, idag, ut));

  if (!heltall(s.km_na, 0, 1_500_000) || (typeof k.km_ved_kjop === "number" && (s.km_na as number) < k.km_ved_kjop))
    feil("km_na", "kan ikke være lavere enn kilometerstanden ved kjøpet");

  if (nokler(s.del6_kontakt_med_selger, NOKLER.del6_kontakt_med_selger, "del6_kontakt_med_selger", ut)) {
    const d = s.del6_kontakt_med_selger as Record<string, unknown>;
    const p = "del6_kontakt_med_selger";
    if (!enAv(d.tatt_opp_med_selger, ["nei", "ja_muntlig", "ja_skriftlig"])) feil(`${p}.tatt_opp_med_selger`, "velg et svar");
    if (d.tatt_opp_med_selger === "nei") {
      for (const n of ["dato_forste_gang", "selgers_svar", "avtale_beskrivelse", "selger_dokumentasjon_kort"]) if (d[n] !== null) feil(`${p}.${n}`, "skal være tom når du ikke har tatt det opp");
      for (const n of ["avtale_inngatt", "selger_la_frem_dokumentasjon"]) if (d[n] !== "nei") feil(`${p}.${n}`, "skal være nei når du ikke har tatt det opp");
      if (!Array.isArray(d.avtale_gjelder_feil) || d.avtale_gjelder_feil.length) feil(`${p}.avtale_gjelder_feil`, "skal være tom når du ikke har tatt det opp");
    } else {
      const tidligst = liste.map((f) => (f as SkjemaFeil).dato_oppdaget).filter(gyldigDato).sort()[0] ?? "0000-00-00";
      if (!gyldigDato(d.dato_forste_gang) || d.dato_forste_gang < tidligst || d.dato_forste_gang > idag)
        feil(`${p}.dato_forste_gang`, "må være etter at du oppdaget den første feilen, og ikke senere enn i dag");
      if (!enAv(d.selgers_svar, ["ikke_svart", "avvist", "tilbudt_reparasjon", "tilbudt_delvis", "enige_om_noe"])) feil(`${p}.selgers_svar`, "velg et svar");
      const kanAvtale = enAv(d.selgers_svar, ["tilbudt_delvis", "enige_om_noe"]);
      if (!enAv(d.avtale_inngatt, kanAvtale ? ["ja", "nei"] : ["nei"])) feil(`${p}.avtale_inngatt`, kanAvtale ? "velg ja eller nei" : "skal være nei");
      if (d.avtale_inngatt === "ja" ? !tekst(d.avtale_beskrivelse, 3, 500) : d.avtale_beskrivelse !== null) feil(`${p}.avtale_beskrivelse`, "beskriv avtalen");
      const ider = liste.map((_, i) => `F${i + 1}`);
      const gjelder = Array.isArray(d.avtale_gjelder_feil) ? d.avtale_gjelder_feil : null;
      if (!gjelder || gjelder.some((x) => !ider.includes(x)) || new Set(gjelder).size !== gjelder.length || (d.avtale_inngatt === "ja" ? !gjelder.length : gjelder.length > 0))
        feil(`${p}.avtale_gjelder_feil`, d.avtale_inngatt === "ja" ? "velg hvilke feil avtalen gjelder" : "skal være tom");
      const kanDok = d.selgers_svar === "avvist";
      if (!enAv(d.selger_la_frem_dokumentasjon, kanDok ? ["ja", "nei"] : ["nei"])) feil(`${p}.selger_la_frem_dokumentasjon`, kanDok ? "velg ja eller nei" : "skal være nei");
      if (d.selger_la_frem_dokumentasjon === "ja" ? !tekst(d.selger_dokumentasjon_kort, 2, 200) : d.selger_dokumentasjon_kort !== null)
        feil(`${p}.selger_dokumentasjon_kort`, "beskriv dokumentasjonen kort (høyst 200 tegn)");
    }
  }

  if (nokler(s.del7_onske_og_kontakt, NOKLER.del7_onske_og_kontakt, "del7_onske_og_kontakt", ut)) {
    const d = s.del7_onske_og_kontakt as Record<string, unknown>;
    if (!enAv(d.onsket_losning, ["reparasjon", "prisavslag", "angre_kjopet"])) feil("del7_onske_og_kontakt.onsket_losning", "velg hva du ønsker");
    if (nokler(d.kjoper, ["navn", "adresse", "epost"], "del7_onske_og_kontakt.kjoper", ut)) {
      const kj = d.kjoper as Record<string, unknown>;
      if (!tekst(kj.navn, 2, 120)) feil("del7_onske_og_kontakt.kjoper.navn", "skriv navnet ditt");
      if (!tekst(kj.adresse, 5, 200)) feil("del7_onske_og_kontakt.kjoper.adresse", "skriv adressen din");
      if (typeof kj.epost !== "string" || !EPOST.test(kj.epost.trim())) feil("del7_onske_og_kontakt.kjoper.epost", "ugyldig e-postadresse");
    }
  }

  if (nokler(s.bekreftelser, NOKLER.bekreftelser, "bekreftelser", ut)) {
    const b = s.bekreftelser as Record<string, unknown>;
    if (b.opplysningene_er_riktige !== true) feil("bekreftelser.opplysningene_er_riktige", "må bekreftes");
    if (b.lest_at_brevet_ikke_er_juridisk_radgivning !== true) feil("bekreftelser.lest_at_brevet_ikke_er_juridisk_radgivning", "må bekreftes");
  }
  return ut;
}

function validerFeil(raa: unknown, i: number, kjopsdato: string, idag: string, ut: Valideringsfeil[]) {
  const p = `del3_feil[${i}]`;
  const feil = (felt: string, melding: string) => ut.push({ felt: `${p}.${felt}`, melding });
  if (!nokler(raa, NOKLER.feil, p, ut)) return;
  const f = raa as Record<string, unknown>;
  if (f.id !== `F${i + 1}`) feil("id", `skal være F${i + 1}`);
  if (!enAv(f.kategori, KATEGORIER.map((x) => x.nokkel))) feil("kategori", "velg hva slags feil det er");
  // One sentence: no sentence break inside, a final full stop is allowed.
  if (!tekst(f.en_setning, 10, 200) || /[.!?]\s+\S/.test(String(f.en_setning).trim())) feil("en_setning", "én setning på 10–200 tegn");
  if (!gyldigDato(f.dato_oppdaget) || f.dato_oppdaget < kjopsdato || f.dato_oppdaget > idag) feil("dato_oppdaget", "må være mellom kjøpsdatoen og i dag");
  if (!enAv(f.kan_bilen_brukes, ["ja", "ja_begrenset", "nei"])) feil("kan_bilen_brukes", "velg et svar");

  if (!enAv(f.selger_sa_noe, ["nei", "ja_skriftlig", "ja_muntlig"])) feil("selger_sa_noe", "velg et svar");
  const skriftlig = f.selger_sa_noe === "ja_skriftlig";
  const hvor = Array.isArray(f.hvor_sto_det) ? f.hvor_sto_det : null;
  const gyldigeHvor: readonly string[] = HVOR_STO_DET.map((h) => h.nokkel);
  if (!hvor || hvor.some((h) => !gyldigeHvor.includes(h)) || (skriftlig ? hvor.length === 0 : hvor.length > 0))
    feil("hvor_sto_det", skriftlig ? "velg minst ett sted" : "skal være tom");
  if (skriftlig ? !tekst(f.avskrift_selger, 3, 500) : f.avskrift_selger !== null) feil("avskrift_selger", skriftlig ? "skriv av det som sto (3–500 tegn)" : "skal være tom");
  if (typeof f.svar_pa_direkte_sporsmal !== "boolean") feil("svar_pa_direkte_sporsmal", "mangler");
  else if (f.svar_pa_direkte_sporsmal && !hvor?.includes("sms_epost_chat")) feil("svar_pa_direkte_sporsmal", "gjelder bare SMS, e-post eller chat");

  if (!enAv(f.verksted_sett_pa, ["nei", "ja_skriftlig", "ja_muntlig"])) feil("verksted_sett_pa", "velg et svar");
  const rapport = f.verksted_sett_pa === "ja_skriftlig";
  const r = f.rapport_sier as Record<string, unknown> | null;
  if (!nokler(r, Object.keys(RAPPORT_TOM), `${p}.rapport_sier`, ut)) return;
  const svar = ["ja", "nei", "star_ikke"] as const;
  for (const n of Object.keys(RAPPORT_TOM)) {
    if (rapport ? !enAv(r![n], svar) : r![n] !== "star_ikke") feil(`rapport_sier.${n}`, rapport ? "velg et svar" : "skal være «står ikke» uten skriftlig rapport");
  }
  if (rapport ? !tekst(f.verksted_navn_dato, 2, 120) : f.verksted_navn_dato !== null) feil("verksted_navn_dato", rapport ? "skriv verkstedet og datoen" : "skal være tom");
  if (r!.kostnad === "ja" ? !heltall(f.kostnad_kr, 1, 3_000_000) : f.kostnad_kr !== null) feil("kostnad_kr", r!.kostnad === "ja" ? "skriv beløpet" : "skal være tom");
  if (rapport ? !tekst(f.avskrift_verksted, 10, 600) : f.avskrift_verksted !== null) feil("avskrift_verksted", rapport ? "skriv av konklusjonen (10–600 tegn)" : "skal være tom");
}
