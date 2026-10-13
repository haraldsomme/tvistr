import { dato, kr, km, liste, orgnr } from "./format";
import { form, ledd } from "./feiltype";
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
    ut.push({ tekst: `Jeg reklamerte ${k.form} til dere den ${dato(k.dato)}.`, kilde: "skjema:kontakt" });
    // What the seller answered. «Annet» gives no sentence, and an offer to repair only when no repair
    // has been tried (otherwise «Dere har forsøkt å rette» under «Mangelen» says it).
    if (k.svar === "avviste") ut.push({ tekst: "Dere avviste reklamasjonen.", kilde: "skjema:kontakt.svar" });
    if (k.svar === "ikke_svart") ut.push({ tekst: "Jeg har ikke fått svar.", kilde: "skjema:kontakt.svar" });
    if (k.svar === "tilbod_retting" && k.forsok === 0) ut.push({ tekst: "Dere tilbød retting, men den er ikke gjennomført.", kilde: "skjema:kontakt.svar; skjema:kontakt.forsok" });
  }

  // What the seller said, for the defects about what the seller said or promised. For a technical
  // defect the letter does not say what the seller said here (it belongs under «Mangelen»).
  for (const [i, f] of s.feil.entries()) {
    if (f.opplysning === "nei") continue;
    const former = ledd([f]).filter((l) => l.type === "opplysning" || l.type === "garanti").map(form);
    if (former.length) ut.push({ tekst: `Før kjøpet opplyste dere ${f.opplysning} om ${liste(former)}.`, kilde: `skjema:feil[${i}].opplysning` });
  }
  return ut;
}
