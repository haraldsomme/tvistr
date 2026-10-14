import { dato, liste, naar, smaa } from "./format";
import { feilnavn, form, ledd, tekniskFeil, tekniskSa } from "./feiltype";
import { harPunkt } from "./rapport";
import { innenToManeder, plussManeder, reklamasjonFor, tidsnivaFor } from "./tidslinje";
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
  // The technical defects the seller did not tell of before the sale: «som den er» does not answer for
  // them. Where the seller told of the defect itself, the letter does not argue around that.
  const fri = tek.filter((l) => tekniskSa(l.feil) !== "feilen");
  if (tek.length) {
    // Before 2024 a car sold «som den er» is judged by § 17 whatever the seller said.
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
    // Since 2024 «som den er» is no longer a ground of its own. The buyer is told so for the defects the
    // seller did not tell of, named when the seller told of others: for those the buyer may have been
    // «spesielt opplyst», and the letter does not argue around that.
    if (v === "etter_2024" && s.somDenEr === "ja" && fri.length) {
      const fs = unike(fri.map((l) => l.feil));
      const om = fri.length < tek.length ? `For ${liste(fs.map((f) => smaa(feilnavn(f))))}: ` : "";
      ut.push({ tekst: `${om}Forbeholdet om at bilen ble solgt «som den er», er ikke et avtalt unntak etter ${lov("forbehold")}.`, kilde: kilde(v, `skjema:somDenEr; ${idx(fri)}.opplysning`, "forbehold") });
      ut.push({
        tekst: `Unntaket fra ${LOVORD.kravTredjeFjerde} forutsetter at jeg ved inngåelsen av avtalen ${LOVORD.avtaltUnntak}.`,
        kilde: kilde(v, `${idx(fri)}.opplysning`, "forbehold"),
      });
    }
  }

  const opp = alle.filter((l) => l.type === "opplysning");
  const sa = opp.filter((l) => l.feil.opplysning !== "nei");
  const ikkeSa = opp.filter((l) => l.feil.opplysning === "nei");
  // A technical defect the seller said was in order or recently repaired is also a defect against what
  // the seller said (§ 16 c), besides the one against what the buyer could expect.
  const iOrden = unike(tek.filter((l) => tekniskFeil(l.feil) && tekniskSa(l.feil) === "i_orden").map((l) => l.feil));
  if (sa.length || iOrden.length)
    ut.push({
      tekst: `Bilen svarer ikke til de opplysningene dere ga om ${liste([...unike(sa.map(form)), ...iOrden.map((f) => smaa(feilnavn(f)))])}, og har en mangel etter ${lov("uriktig")}.`,
      kilde: kilde(v, [sa.length && `${idx(sa)}.opplysning`, ...iOrden.map((f) => `skjema:feil[${s.feil.indexOf(f)}].opplyst`)].filter(Boolean).join("; "), "uriktig"),
    });
  if (ikkeSa.length)
    ut.push({
      tekst: `Dere har forsømt å opplyse om ${liste(unike(ikkeSa.map(form)))}, som dere burde kjenne til og som jeg hadde grunn til å regne med å få${henv("tilbakeholdt")}.`,
      kilde: kilde(v, `${idx(ikkeSa)}.opplysning`, "tilbakeholdt"),
    });

  const garanti = alle.filter((l) => l.type === "garanti");
  // A warranty that was agreed and not delivered is a breach of the contract and of what the seller
  // said about it. § 18 a is not the ground of the defect.
  if (garanti.length) {
    const ref = (p: Poeng) => (nevnt ? parRef(v, p) : lov(p));
    ut.push({ tekst: "Bilen ble ikke levert med den garantien som ble avtalt.", kilde: `${idx(garanti)}.hoved` });
    ut.push({
      tekst: `Den svarer dermed ikke til avtalen, jf. ${ref("avtale")}, jf. ${ref("avvik")}, og til opplysningene dere ga om garantien, jf. ${ref("uriktig")}.`,
      kilde: kilde(v, `${idx(garanti)}.hoved; ${idx(garanti)}.opplysning`, "avtale", "avvik", "uriktig"),
    });
  }

  // No claim of a defect before the cause is known: the letter only gives notice. That it is a
  // complaint, and in time, is said in «Mangelen» and under the time of the complaint.
  const vet = alle.filter((l) => l.type === "vet_ikke");
  for (const tid of unike(vet.map((l) => naar(l.feil.oppdaget, l.feil.omtrentlig)))) {
    const dem = vet.filter((l) => naar(l.feil.oppdaget, l.feil.omtrentlig) === tid);
    ut.push({ tekst: `Bilen har en funksjonssvikt som viste seg ${tid}.`, kilde: `${idx(dem)}.oppdaget` });
  }
  return ut;
}

// Tidspunkt: whether the defect is presumed to have existed at delivery, or the notice is in time.
// The presumption and the proof of what the defect was at delivery are for technical defects only:
// for what the seller said, the time of showing is of no consequence, and for a symptom without a
// known cause there is no defect to date yet. The time limit of § 27 is for every kind of defect that
// showed itself more than two years after delivery.
export function tidspunkt(s: Brevsak): Setning[] {
  const v = lovversjon(s.kjopsdato);
  const tek = unike(ledd(s.feil).filter((l) => l.type === "teknisk").map((l) => l.feil));
  const sene = unike(ledd(s.feil).filter((l) => l.type !== "teknisk").map((l) => l.feil)).filter((f) => !tek.includes(f) && tidsnivaFor(s.kjopsdato, f.oppdaget, v).tidsnivaa === 3);
  const rimelig = rimeligTid(s);
  if (!tek.length && !sene.length) return rimelig;
  const i = (f: Brevfeil) => s.feil.indexOf(f);
  const med = (fs: Brevfeil[]) => `skjema:feil[${fs.map(i).join(",")}].oppdaget`;
  // The time level is worked out from the day the defect was discovered (tidslinje.ts).
  const innenFristen = (f: Brevfeil) => tidsnivaFor(s.kjopsdato, f.oppdaget, v).tidsnivaa === 1;
  const gjelder = tek.filter(innenFristen);
  const utenfor = tek.filter((f) => !innenFristen(f));
  // The defects the time limit is about: the technical ones outside the presumption, and the late others.
  const frister = [...utenfor, ...sene];
  // The time-limit sentence says which defects it is about when it does not cover all of those it speaks of.
  const fristFeil = frister.length < tek.length + sene.length ? `For ${liste(frister.map((f) => smaa(feilnavn(f))))}: ` : "";
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

  if (frister.length) {
    // A defect is complained about in the earlier complaint if it was in it, otherwise in this letter;
    // the sentence holds for the latest of those days.
    const datoer = frister.map((f) => reklamasjonFor(f, s.kontakt?.dato, s.dato));
    const sendt = datoer.map((r) => r.dato).sort().at(-1)!;
    const poeng = sendt <= plussManeder(s.kjopsdato, 24) ? "reklamasjon_2ar" : sendt <= plussManeder(s.kjopsdato, 60) ? "reklamasjon_5ar" : null;
    // Past five years there is nothing to say: the form and the server turn such a case away.
    if (poeng)
      ut.push({
        tekst: `${fristFeil}Reklamasjonen er fremsatt innen ${poeng === "reklamasjon_2ar" ? "to år" : "fristen på fem år"} etter at bilen ble levert${jf(v, poeng)}.`,
        kilde: kilde(v, `${med(frister)}; skjema:kjopsdato; ${[datoer.some((r) => r.omfattet) && "skjema:kontakt", datoer.some((r) => !r.omfattet) && "fast:dato"].filter(Boolean).join("; ")}`, poeng),
      });
  }
  ut.push(...rimelig);

  if (utenfor.length) {
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

// § 27 første ledd: a complaint within two months of the discovery is always in time. Each defect is
// complained about in the earlier complaint if it was in it, otherwise in this letter; the defects
// complained about later than that get no sentence (the form warns), and are named apart from the rest.
function rimeligTid(s: Brevsak): Setning[] {
  const v = lovversjon(s.kjopsdato);
  const itide = s.feil.filter((f) => innenToManeder(f, reklamasjonFor(f, s.kontakt?.dato, s.dato).dato));
  if (!itide.length) return [];
  const om = itide.length < s.feil.length ? `For ${liste(itide.map((f) => smaa(feilnavn(f))))}: ` : "";
  return [
    {
      tekst: `${om}Reklamasjonen er fremsatt innen to måneder etter at ${itide.length > 1 ? "feilene" : "feilen"} ble oppdaget, og dermed innen rimelig tid${jf(v, "reklamasjon")}.`,
      kilde: kilde(v, `skjema:feil[${itide.map((f) => s.feil.indexOf(f)).join(",")}].oppdaget; ${s.kontakt ? "skjema:kontakt" : "fast:dato"}`, "reklamasjon"),
    },
  ];
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
