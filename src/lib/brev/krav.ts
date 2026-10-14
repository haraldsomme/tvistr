import { feilnavn, ledd } from "./feiltype";
import { FORSOK_ANTALL, kr, liste, smaa } from "./format";
import { jf, lovkilde, lovversjon, type Poeng } from "./paragrafer";
import { forsokAv, harPunkt, overslagSum } from "./rapport";
import type { Brevsak, Setning } from "./typer";

// What the seller said or the car's history: a repair cannot make it right, so the letter does not
// invite the seller to repair it. «service» alone is the main category without a subcategory, all of
// whose subcategories are in the list. Warranty, equipment, EU control, rebuilding and every technical
// defect keep the offer.
const KAN_IKKE_RETTES = ["service.service", "service.servicehefte", "historikk.km", "historikk.bruk", "historikk.import", "historikk.skade", "historikk.pant", "service"];

// 4. Krav: one of retting, prisavslag or heving, then damages for expenses if the buyer claims them.
export function krav(s: Brevsak): Setning[][] {
  const v = lovversjon(s.kjopsdato);
  // A symptom without a known cause can only be examined and repaired. With known defects beside it the
  // claim is for the known ones, and the symptom gets its own demand (under prisavslag) or is left to
  // the cancellation (heving), which returns the whole car.
  const kjente = s.feil.filter((f) => f.hoved !== "vet_ikke");
  const ukjente = s.feil.filter((f) => f.hoved === "vet_ikke");
  const blandet = kjente.length > 0 && ukjente.length > 0 && s.krav !== "retting";
  const flere = (blandet ? kjente : s.feil).length > 1;
  const mangelen = flere ? "mangelene" : "mangelen";
  const lov = (p: Poeng) => `skjema:krav; ${lovkilde(v, p)}`;
  const hoved: Setning[] = [];
  const forsok = forsokAv(s);
  const svar = s.kontakt?.svar;
  // A seller who has turned the complaint down or not answered it will not offer to repair.
  const ingenRetting = svar === "avviste" || svar === "ikke_svart";

  if (s.krav === "retting") {
    hoved.push({ tekst: `På dette grunnlaget krever jeg at ${mangelen} rettes uten kostnad for meg og innen rimelig tid${jf(v, "retting")}.`, kilde: lov("retting") });
    // A workshop that advises against using the car: the repair is urgent.
    const frarader = s.feil.filter((f) => harPunkt(f.rapport, "frarader"));
    if (frarader.length)
      hoved.push({
        tekst: "Bilen kan etter verkstedets vurdering ikke brukes før feilen er rettet, og jeg ber om at rettingen prioriteres.",
        kilde: frarader.map((f) => `skjema:feil[${s.feil.indexOf(f)}].rapport.punkter.frarader`).join("; "),
      });
  }

  if (s.krav === "prisavslag") {
    // The workshops' estimates, added up over the defects.
    const o = overslagSum(s);
    hoved.push({
      tekst: `På dette grunnlaget krever jeg prisavslag${jf(v, "prisavslag")}${o ? `, tilsvarende utbedringskostnaden på ${kr(o.sum)} ifølge ${o.antallRapporter > 1 ? "verkstedenes" : "verkstedets"} overslag` : ""}.`,
      kilde: `${lov("prisavslag")}${o ? "; skjema:feil[].rapport.overslag" : ""}`,
    });
  }

  if (s.krav === "heving") {
    hoved.push({ tekst: `På dette grunnlaget hever jeg kjøpet${jf(v, "heving")}.`, kilde: lov("heving") });
    hoved.push({
      tekst: `${flere ? "Mangelene er ikke uvesentlige" : "Mangelen er ikke uvesentlig"}${forsok > 0 ? `, og dere har ikke lykkes med å rette ${flere ? "dem" : "den"} etter ${FORSOK_ANTALL[forsok]}` : ""}.`,
      kilde: `skjema:krav${forsok > 0 ? "; skjema:kontakt.forsok" : ""}`,
    });
    if (ingenRetting)
      hoved.push({
        tekst: `Dere har ${svar === "avviste" ? "avvist" : "ikke besvart"} reklamasjonen, og jeg legger til grunn at retting ikke vil bli tilbudt.`,
        kilde: "skjema:kontakt.svar",
      });
    hoved.push({ tekst: `Jeg krever kjøpesummen på ${kr(s.kjopesum)} tilbakebetalt, mot at bilen stilles til deres disposisjon.`, kilde: "skjema:kjopesum" });
  }

  if (blandet && s.krav === "prisavslag")
    hoved.push({
      tekst: `For ${liste(ukjente.map((f) => smaa(feilnavn(f))))} krever jeg at årsaken undersøkes og at feilen rettes uten kostnad for meg${jf(v, "retting")}.`,
      kilde: `${ukjente.map((f) => `skjema:feil[${s.feil.indexOf(f)}].hoved`).join("; ")}; ${lovkilde(v, "retting")}`,
    });

  // The seller may offer to repair even when the buyer asks for a reduction or to cancel (the repair
  // rules in §§ 29–30), unless repairs have already been tried, or the seller has turned the complaint
  // down and the buyer cancels, or nothing in the letter can be repaired.
  const kanRettes = ledd(s.feil).some((l) => !KAN_IKKE_RETTES.includes(l.under ? `${l.feil.hoved}.${l.under}` : l.feil.hoved));
  if ((s.krav === "prisavslag" || s.krav === "heving") && forsok === 0 && kanRettes && !(s.krav === "heving" && ingenRetting)) {
    hoved.push({ tekst: `Dersom dere ønsker å rette ${mangelen} selv, ber jeg om beskjed innen fristen under.`, kilde: `skjema:krav; skjema:kontakt; ${lovkilde(v, "retting")}` });
    hoved.push({ tekst: `Retting må i så fall skje uten kostnad og uten vesentlig ulempe for meg og innen rimelig tid${jf(v, "retting")}.`, kilde: lov("retting") });
  }

  const ut: Setning[][] = [hoved];
  if (s.utlegg.length) {
    const sum = s.utlegg.reduce((t, u) => t + u.belop, 0);
    const poster = s.utlegg.map((u) => `${u.beskrivelse.trim().replace(/[.;,]+$/, "")} ${kr(u.belop)}`).join("; ");
    ut.push([
      {
        tekst: `I tillegg krever jeg erstatning for utlegg som følge av ${mangelen}${jf(v, "erstatning")}: ${poster}. Til sammen ${kr(sum)}. Kvitteringer vedlegges.`,
        kilde: `skjema:utlegg; ${lovkilde(v, "erstatning")}`,
      },
    ]);
  }
  return ut;
}
