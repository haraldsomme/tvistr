import { dato, liste, naar, smaa } from "./format";
import { feilnavn, form, ledd } from "./feiltype";
import { harPunkt } from "./rapport";
import { plussManeder, tidsnivaFor } from "./tidslinje";
import { jf, type Lovversjon, LOVORD, lovkilde, lovRef, lovversjon, parRef, type Poeng } from "./paragrafer";
import type { Brevfeil, Brevsak, Setning } from "./typer";

// 3. Rettslig vurdering, in the order mangel → tidspunkt → praksis. The paragraph numbers come from
// paragrafer.ts for the law that applied to the purchase; nothing is written here as a number.
const unike = <T>(xs: T[]) => [...new Set(xs)];
const kilde = (v: Lovversjon, felt: string, ...poeng: Poeng[]) => [felt, ...poeng.map((p) => lovkilde(v, p))].join("; ");

// Mangel: one sentence per kind of defect, with like kinds merged.
export function mangel(s: Brevsak): Setning[] {
  const v = lovversjon(s.kjopsdato);
  const alle = ledd(s.feil);
  const ut: Setning[] = [];
  const idx = (ls: typeof alle) => `skjema:feil[${unike(ls.map((l) => l.i)).join(",")}]`;
  // The first reference in the section names the act; the later ones can stand with the paragraph alone.
  let nevnt = false;
  const lov = (p: Poeng) => ((nevnt = true), lovRef(v, p));
  const henv = (...poeng: Poeng[]) => {
    const t = jf(v, ...poeng);
    if (!t || nevnt) return t;
    nevnt = true;
    return t.replace(", jf. ", ", jf. forbrukerkjøpsloven ");
  };

  const tek = alle.filter((l) => l.type === "teknisk");
  if (tek.length) {
    if (v === "før_2024" && s.somDenEr === "ja")
      ut.push({
        tekst: `Selv om bilen ble solgt «som den er», har den en mangel, fordi den er ${LOVORD.dårligereStand}${henv("forbehold")}.`,
        kilde: kilde(v, `${idx(tek)}.hoved; skjema:somDenEr`, "forbehold"),
      });
    else
      ut.push({
        tekst: `Bilen svarer ikke til det jeg hadde grunn til å forvente når det gjelder holdbarhet og andre egenskaper, og har en mangel etter ${lov("avvik")}${henv("krav")}.`,
        kilde: kilde(v, `${idx(tek)}.hoved`, "avvik", "krav"),
      });
    // Since 2024 «som den er» is no longer a ground of its own. The buyer is told so only where the
    // seller said nothing about any of the defects: with something said, the buyer may have been
    // «spesielt opplyst», and the letter does not argue around that.
    if (v === "etter_2024" && s.somDenEr === "ja" && tek.every((l) => l.feil.opplysning === "nei")) {
      ut.push({ tekst: `Forbeholdet om at bilen ble solgt «som den er», er ikke et avtalt unntak etter ${lov("forbehold")}.`, kilde: kilde(v, "skjema:somDenEr", "forbehold") });
      ut.push({
        tekst: `Unntaket fra ${LOVORD.kravTredjeFjerde} forutsetter at jeg ved inngåelsen av avtalen ${LOVORD.avtaltUnntak}.`,
        kilde: kilde(v, `${idx(tek)}.opplysning`, "forbehold"),
      });
    }
  }

  const opp = alle.filter((l) => l.type === "opplysning");
  const sa = opp.filter((l) => l.feil.opplysning !== "nei");
  const ikkeSa = opp.filter((l) => l.feil.opplysning === "nei");
  if (sa.length)
    ut.push({
      tekst: `Bilen svarer ikke til de opplysningene dere ga om ${liste(unike(sa.map(form)))}, og har en mangel etter ${lov("uriktig")}.`,
      kilde: kilde(v, `${idx(sa)}.opplysning`, "uriktig"),
    });
  if (ikkeSa.length)
    ut.push({
      tekst: `Dere har forsømt å opplyse om ${liste(unike(ikkeSa.map(form)))}, som dere burde kjenne til og som jeg hadde grunn til å regne med å få${henv("tilbakeholdt")}.`,
      kilde: kilde(v, `${idx(ikkeSa)}.opplysning`, "tilbakeholdt"),
    });

  const garanti = alle.filter((l) => l.type === "garanti");
  if (garanti.length) ut.push({ tekst: `Bilen ble ikke levert med den garantien som ble avtalt${henv("krav", "garanti")}.`, kilde: kilde(v, `${idx(garanti)}.hoved`, "krav", "garanti") });

  // No claim of a defect before the cause is known: the letter only gives notice.
  const vet = alle.filter((l) => l.type === "vet_ikke");
  for (const tid of unike(vet.map((l) => naar(l.feil.oppdaget, l.feil.omtrentlig)))) {
    const dem = vet.filter((l) => naar(l.feil.oppdaget, l.feil.omtrentlig) === tid);
    const reklamasjon = s.kontakt ? `jeg reklamerte på denne ${s.kontakt.form} den ${dato(s.kontakt.dato)}` : "jeg reklamerer herved på denne";
    ut.push({
      tekst: `Bilen har en funksjonssvikt som viste seg ${tid}, og ${reklamasjon}${henv("reklamasjon")}.`,
      kilde: kilde(v, `${idx(dem)}.oppdaget${s.kontakt ? "; skjema:kontakt" : ""}`, "reklamasjon"),
    });
  }
  return ut;
}

// Tidspunkt: whether the defect is presumed to have existed at delivery, or the notice is in time.
// Only for technical defects: for what the seller said, the time of showing is of no consequence,
// and for a symptom without a known cause there is no defect to date yet.
export function tidspunkt(s: Brevsak): Setning[] {
  const v = lovversjon(s.kjopsdato);
  const tek = unike(ledd(s.feil).filter((l) => l.type === "teknisk").map((l) => l.feil));
  if (!tek.length) return [];
  const i = (f: Brevfeil) => s.feil.indexOf(f);
  const med = (fs: Brevfeil[]) => `skjema:feil[${fs.map(i).join(",")}].oppdaget`;
  // The time level is worked out from the day the defect was discovered (tidslinje.ts).
  const innenFristen = (f: Brevfeil) => tidsnivaFor(s.kjopsdato, f.oppdaget, v).tidsnivaa === 1;
  const gjelder = tek.filter(innenFristen);
  const utenfor = tek.filter((f) => !innenFristen(f));
  // With defects in both groups each sentence says which defects it is about.
  const prefiks = (fs: Brevfeil[]) => (gjelder.length && utenfor.length ? `For ${liste(fs.map((f) => smaa(feilnavn(f))))}: ` : "");
  const mangelen = (fs: Brevfeil[]) => (fs.length > 1 ? "Mangelene" : "Mangelen");
  const ut: Setning[] = [];

  // A sentence about some of the defects says which when the others are treated differently.
  const omFeil = (fs: Brevfeil[], hele: Brevfeil[]) => (gjelder.length && utenfor.length) || fs.length < hele.length ? `For ${liste(fs.map((f) => smaa(feilnavn(f))))}: ` : "";
  const rapportKilde = (fs: Brevfeil[], felt: string) => fs.map((f) => `skjema:feil[${i(f)}].rapport.${felt}`).join("; ");

  if (gjelder.length) {
    ut.push({
      tekst: `${prefiks(gjelder)}${mangelen(gjelder)} viste seg innen ${v === "etter_2024" ? "to år" : "seks måneder"} etter overtakelsen og formodes etter ${parRef(v, "formodning")} å ha eksistert ved leveringen, med mindre dere beviser noe annet.`,
      kilde: kilde(v, `${med(gjelder)}; skjema:kjopsdato`, "formodning"),
    });
    // The workshop's assessment that it is not normal wear points the same way as the presumption.
    const slitasje = gjelder.filter((f) => harPunkt(f.rapport, "ikke_slitasje"));
    if (slitasje.length)
      ut.push({
        tekst: `${omFeil(slitasje, gjelder)}Verkstedets vurdering av at ${slitasje.length > 1 ? "feilene" : "feilen"} ikke skyldes normal slitasje, taler i samme retning.`,
        kilde: rapportKilde(slitasje, "punkter.ikke_slitasje"),
      });
  }

  if (utenfor.length) {
    // The notice is dated by the earlier one if the buyer has given notice before, otherwise by this letter.
    const sendt = s.kontakt?.dato ?? s.dato;
    const poeng = sendt <= plussManeder(s.kjopsdato, 24) ? "reklamasjon_2ar" : sendt <= plussManeder(s.kjopsdato, 60) ? "reklamasjon_5ar" : null;
    // Past five years there is nothing to say: the form and the server turn such a case away.
    if (poeng)
      ut.push({
        tekst: `${prefiks(utenfor)}Reklamasjonen er fremsatt innen ${poeng === "reklamasjon_2ar" ? "to år" : "fristen på fem år"} etter at bilen ble levert${jf(v, poeng)}.`,
        kilde: kilde(v, `skjema:kjopsdato; ${s.kontakt ? "skjema:kontakt" : "fast:dato"}`, poeng),
      });
    // The proof of what the defect was at delivery. The report that says so is cited by its date;
    // a report that does not is only referred to as documentation; no report, no sentence.
    const medRapport = utenfor.filter((f) => f.rapport);
    const tilStede = medRapport.filter((f) => harPunkt(f.rapport, "til_stede"));
    const uten = medRapport.filter((f) => !harPunkt(f.rapport, "til_stede"));
    if (tilStede.length) {
      const datoer = unike(tilStede.map((f) => dato(f.rapport!.dato)));
      ut.push({
        tekst: `${omFeil(tilStede, utenfor)}${datoer.length > 1 ? "Verkstedene" : "Verkstedet"} legger til grunn at ${tilStede.length > 1 ? "feilene" : "feilen"} forelå ved leveringen, jf. ${datoer.length > 1 ? "rapportene" : "rapporten"} av ${liste(datoer)}.`,
        kilde: [rapportKilde(tilStede, "punkter.til_stede"), rapportKilde(tilStede, "dato")].join("; "),
      });
    }
    if (uten.length)
      ut.push({
        tekst: `${omFeil(uten, utenfor)}Til dokumentasjon av forholdet viser jeg til verkstedets skriftlige vurdering, som følger vedlagt.`,
        kilde: rapportKilde(uten, "dato"),
      });
  }
  return ut;
}

// Praksis: the paragraph citing the decision, unchanged. Without a decision there is nothing to say;
// the law sentence «Kravet bygger på lovens vilkår» is not needed when the rest of the section stands.
// When the decision applied the other version of the law than the buyer's purchase, the letter says so.
export function praksis(s: Brevsak): Setning[] {
  if (!s.praksis) return [];
  const p = s.praksis;
  const kilde = `vedtak:${p.saksnummer ?? p.kildeUrl}`;
  const ut: Setning[] = [{ tekst: p.avsnitt, kilde, lenke: p.kildeUrl }];
  const kjopers = lovversjon(s.kjopsdato);
  if (p.lovversjon && p.lovversjon !== "ukjent" && p.lovversjon !== kjopers)
    ut.push({
      tekst: p.lovversjon === "før_2024" ? "Vedtaket ble avgjort etter loven slik den lød før 1.1.2024." : "Vedtaket ble avgjort etter loven slik den lyder fra 1.1.2024.",
      kilde: `${kilde}.lovversjon; skjema:kjopsdato`,
    });
  return ut;
}
