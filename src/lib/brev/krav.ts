import { FORSOK_ANTALL, kr } from "./format";
import { jf, lovkilde, lovversjon, type Poeng } from "./paragrafer";
import type { Brevsak, Setning } from "./typer";

// 4. Krav: one of retting, prisavslag or heving, then damages for expenses if the buyer claims them.
export function krav(s: Brevsak): Setning[][] {
  const v = lovversjon(s.kjopsdato);
  const flere = s.feil.length > 1;
  const mangelen = flere ? "mangelene" : "mangelen";
  const lov = (p: Poeng) => `skjema:krav; ${lovkilde(v, p)}`;
  const hoved: Setning[] = [];

  if (s.krav === "retting")
    hoved.push({ tekst: `På dette grunnlaget krever jeg at ${mangelen} rettes uten kostnad for meg og innen rimelig tid${jf(v, "retting")}.`, kilde: lov("retting") });

  if (s.krav === "prisavslag")
    hoved.push({
      tekst: `På dette grunnlaget krever jeg prisavslag${jf(v, "prisavslag")}${s.overslag ? `, tilsvarende utbedringskostnaden på ${kr(s.overslag)}` : ""}.`,
      kilde: `${lov("prisavslag")}${s.overslag ? "; skjema:overslag" : ""}`,
    });

  if (s.krav === "heving") {
    hoved.push({ tekst: `På dette grunnlaget hever jeg kjøpet${jf(v, "heving")}.`, kilde: lov("heving") });
    hoved.push({
      tekst: `${flere ? "Mangelene er ikke uvesentlige" : "Mangelen er ikke uvesentlig"}${s.forsok > 0 ? `, og dere har ikke lykkes med å rette ${flere ? "dem" : "den"} etter ${FORSOK_ANTALL[s.forsok]}` : ""}.`,
      kilde: `skjema:krav${s.forsok > 0 ? "; skjema:forsok" : ""}`,
    });
    hoved.push({ tekst: `Jeg krever kjøpesummen på ${kr(s.kjopesum)} tilbakebetalt, mot at bilen stilles til deres disposisjon.`, kilde: "skjema:kjopesum" });
  }

  // The seller may offer to repair even when the buyer asks for a reduction or to cancel (the repair
  // rules in §§ 29–30), unless repairs have already been tried.
  if ((s.krav === "prisavslag" || s.krav === "heving") && s.forsok === 0) {
    hoved.push({ tekst: `Dersom dere ønsker å rette ${mangelen} selv, ber jeg om beskjed innen fristen under.`, kilde: `skjema:krav; skjema:forsok; ${lovkilde(v, "retting")}` });
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
