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
  if (s.tidligere) ut.push({ tekst: `Jeg reklamerte ${s.tidligere.form} til dere den ${dato(s.tidligere.dato)}.`, kilde: "skjema:tidligere" });

  // What the seller said, for the defects about what the seller said or promised. For a technical
  // defect the letter does not say what the seller said here (it belongs under «Mangelen»).
  for (const [i, f] of s.feil.entries()) {
    if (f.opplysning === "nei") continue;
    const former = ledd([f]).filter((l) => l.type === "opplysning" || l.type === "garanti").map(form);
    if (former.length) ut.push({ tekst: `Før kjøpet opplyste dere ${f.opplysning} om ${liste(former)}.`, kilde: `skjema:feil[${i}].opplysning` });
  }
  return ut;
}
