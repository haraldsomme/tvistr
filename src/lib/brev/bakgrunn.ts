import { dato, kr, km, liste, orgnr, smaa } from "./format";
import { feilnavn, form, ledd, tekniskFeil, tekniskSa } from "./feiltype";
import { reklamerte } from "./rapport";
import type { Brevsak, Setning } from "./typer";

// 1. Sakens bakgrunn: what was bought, from whom, for how much, and what the seller said before the sale.
export function bakgrunn(s: Brevsak): Setning[] {
  const forste = s.bil.forsteRegistrert ? `, første gang registrert i ${s.bil.forsteRegistrert}` : "";
  const ut: Setning[] = [
    {
      tekst: `Jeg viser til kjøp av ${s.bil.merke} ${s.bil.modell}${forste}, reg.nr. ${s.bil.regnr}, fra ${s.selger.navn} (org.nr. ${orgnr(s.selger.orgnr)}) den ${dato(s.kjopsdato)}.`,
      kilde: "vegvesen:bil; skjema:kjopsdato; brreg:selger",
    },
    { tekst: `Kjøpesummen var ${kr(s.kjopesum)}.`, kilde: "skjema:kjopesum" },
    // The form has no handover date, so the purchase date stands for it.
    { tekst: `Bilen hadde gått ${km(s.km)} ved overtakelsen.`, kilde: "skjema:km" },
  ];
  if (s.somDenEr === "ja") ut.push({ tekst: "Bilen ble solgt «som den er».", kilde: "skjema:somDenEr" });
  if (s.somDenEr === "nei") ut.push({ tekst: "Det ble ikke tatt forbehold om at bilen ble solgt «som den er».", kilde: "skjema:somDenEr" });
  const k = s.kontakt;
  if (k) {
    // A defect discovered after the complaint was not part of it: the sentence then names the ones that were.
    const { tidligere, nye } = reklamerte(s);
    const paa = nye.length ? ` på ${liste(tidligere.map((f) => smaa(feilnavn(f))))}` : "";
    ut.push({ tekst: `Jeg reklamerte ${k.form} til dere den ${dato(k.dato)}${paa}.`, kilde: `skjema:kontakt${nye.length ? `; ${tidligere.map((f) => `skjema:feil[${s.feil.indexOf(f)}].oppdaget`).join("; ")}` : ""}` });
    // What the seller has done. «Annet» gives no sentence, and the repairs tried are told under
    // «Mangelen» («Dere har forsøkt å rette feilen …»).
    if (k.svar === "avviste") ut.push({ tekst: "Dere avviste reklamasjonen.", kilde: "skjema:kontakt.svar" });
    if (k.svar === "ikke_svart") ut.push({ tekst: "Jeg har ikke fått svar.", kilde: "skjema:kontakt.svar" });
    if (k.svar === "tilbod_retting") ut.push({ tekst: "Dere tilbød retting, men den er ikke gjennomført.", kilde: "skjema:kontakt.svar" });
  }

  // What the seller said, for the defects about what the seller said or promised, and for a technical
  // defect the seller said was in order. That the seller told of the defect itself is not repeated:
  // it only weakens the case (the form warns about it).
  for (const [i, f] of s.feil.entries()) {
    if (f.opplysning === "nei") continue;
    if (tekniskFeil(f)) {
      if (tekniskSa(f) === "i_orden")
        ut.push({ tekst: `Før kjøpet opplyste dere ${f.opplysning} at ${smaa(feilnavn(f))} var i orden eller nylig utbedret.`, kilde: `skjema:feil[${i}].opplysning; skjema:feil[${i}].opplyst` });
      continue;
    }
    const former = ledd([f]).filter((l) => l.type === "opplysning" || l.type === "garanti").map(form);
    if (former.length) ut.push({ tekst: `Før kjøpet opplyste dere ${f.opplysning} om ${liste(former)}.`, kilde: `skjema:feil[${i}].opplysning` });
  }
  return ut;
}
