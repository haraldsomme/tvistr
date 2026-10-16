// The complaint letter, built in the browser from the writer's answers (the artifact's buildLetter).
// Periods and paragraphs follow the law version of the purchase (lov.ts). The section citing a
// decision is Tvistr's paragraph from the server (finnVedtak → mal.ts), never written here.
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { opplysningsfeil } from "@/lib/brev/feiltype";
import { LOVORD } from "@/lib/brev/paragrafer";
import { plussManeder } from "@/lib/brev/tidslinje";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import { addDays, addMonths, dur, fmtD, parseD } from "./dato";
import { regler } from "./lov";
import { DOCS, IMPACT, type Skjema, WS_SAYS, WS_WHO } from "./skjema";

// Text, a placeholder for a missing answer, or bold text.
export type Del = string | { ph: string } | { b: string };
export type Blokk =
  | { t: "addr" | "sign"; linjer: Del[][] }
  | { t: "date" | "subj" | "h" | "p"; tekst: Del[] }
  | { t: "ul" | "ol"; punkter: Del[][] }
  | { t: "prec"; avsnitt: Del[][] }
  | { t: "exp"; rader: [Del[], string][]; sum: string };

// One of the three decisions the letter can cite, as finnVedtak returns it after payment.
export type Presedens = {
  id: number;
  saksnummer: string | null;
  vedtaksdato: string | null;
  bil: string;
  utfall: string[];
  avsnitt: string;
  kildeUrl: string | null;
  utvalg: string;
  best: boolean;
};

type Tekstfelt = { [K in keyof Skjema]: Skjema[K] extends string ? K : never }[keyof Skjema];

const NB = new Intl.NumberFormat("nb-NO");
const kr = (n: number) => `kr ${NB.format(n)}`;
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const trimDot = (s: string) => s.trim().replace(/[.]$/, "");
const unquote = (s: string) => trimDot(s.trim().replace(/^[«"]|[»"]$/g, ""));
const listJoin = (a: string[]) => (a.length < 2 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} og ${a[a.length - 1]}`);
const smaa = (s: string) => (/^[A-ZÆØÅ0-9]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

// «Kapasitet og rekkevidde; lading og ladeutstyr», or the area's name when no part is ticked.
function feilnavn(hoved: string, under: string[]): string {
  const h = HOVEDKATEGORIER.find((x) => x.id === hoved);
  if (!h) return hoved;
  const navn = under.map((u) => h.under.find((x) => x.id === u)?.navn ?? u).map((n, i) => (i ? smaa(n) : n));
  if (!navn.length) return h.navn;
  return navn.some((n) => /\bog\b|,/.test(n)) ? navn.join("; ") : listJoin(navn);
}

// `presedens`: the decision the buyer chose, null without one (the law's sentence), or «venter» while
// finnVedtak is still working, so a letter copied then shows a gap rather than a letter without it.
export function byggBrev(s: Skjema, presedens: Presedens | null | "venter", idag: string): Blokk[] {
  const L = regler(s.c_purchase || s.c_delivery);
  const has = (k: Tekstfelt) => s[k].trim() !== "";
  const v = (k: Tekstfelt, ph: string): Del => (has(k) ? s[k].trim() : { ph });
  const vd = (k: Tekstfelt, ph: string): Del => (has(k) ? fmtD(s[k]) : { ph });
  const firm = s.l_tone === "bestemt";
  const ld = parseD(s.l_date) ?? parseD(idag)!;
  const B: Blokk[] = [];

  const snd: Del[][] = [[v("b_name", "Ditt navn")], [v("b_addr", "Adresse")], [v("b_zip", "Postnr."), " ", v("b_city", "Poststed")]];
  const ct = [has("b_phone") ? `Tlf. ${s.b_phone}` : "", has("b_email") ? s.b_email : ""].filter(Boolean);
  if (ct.length) snd.push([ct.join(" · ")]);
  B.push({ t: "addr", linjer: snd });
  const rc: Del[][] = [[v("d_name", "Forhandlerens navn")]];
  if (has("d_org")) rc.push([`Org.nr. ${s.d_org}`]);
  if (has("d_contact")) rc.push([`Att.: ${s.d_contact}`]);
  rc.push([v("d_addr", "Adresse")], [v("d_zip", "Postnr."), " ", v("d_city", "Poststed")]);
  B.push({ t: "addr", linjer: rc });
  B.push({ t: "date", tekst: [has("l_place") ? s.l_place : has("b_city") ? s.b_city : { ph: "Sted" }, `, ${fmtD(ld)}`] });

  const car: Del = has("c_make") || has("c_model") ? [s.c_make, s.c_model].filter(Boolean).join(" ").trim() : { ph: "Merke og modell" };
  const reg = v("c_reg", "reg.nr.");
  B.push({ t: "subj", tekst: ["Reklamasjon på mangel ved ", car, ", reg.nr. ", reg] });
  B.push({
    t: "p",
    tekst: [
      "Jeg viser til mitt kjøp av brukt ", car, has("c_year") ? `, årsmodell ${s.c_year}` : "", ", reg.nr. ", reg,
      ". Bilen ble kjøpt ", vd("c_purchase", "kjøpsdato"), " for kr ", v("c_price", "kjøpesum"), ", og jeg overtok den ", vd("c_delivery", "overtakelsesdato"),
      has("c_km") ? ` med en kilometerstand på ${s.c_km} km` : "", ".",
    ],
  });
  B.push({ t: "p", tekst: [firm ? `Bilen har en mangel. Jeg reklamerer med dette formelt etter ${L.lovRef("reklamasjon")} og forventer at saken behandles uten opphold.` : `Bilen har en mangel, og jeg reklamerer med dette etter ${L.lovRef("reklamasjon")}.`] });

  B.push({ t: "h", tekst: ["Mangelen"] });
  if (s.f_cats.length) {
    B.push({ t: "p", tekst: ["Jeg har oppdaget følgende feil ved bilen:"] });
    B.push({
      t: "ul",
      punkter: s.f_cats.map((c) => {
        const a = s.f_area[c],
          desc = (s.f_catdesc[c] ?? "").trim();
        return [{ b: feilnavn(c, s.f_parts[c] ?? []) }, ", oppdaget ", a?.found ? fmtD(a.found) : { ph: "dato" }, ".", desc ? ` ${sentence(desc)}` : ""];
      }),
    });
    if (has("f_desc")) B.push({ t: "p", tekst: [sentence(s.f_desc)] });
  } else B.push({ t: "p", tekst: ["Den ", vd("f_found", "dato"), " oppdaget jeg følgende feil: ", has("f_desc") ? sentence(s.f_desc) : { ph: "Beskrivelse av feilen" }] });

  const ex: string[] = [];
  if (s.f_drivable === "nei") ex.push("Bilen kan ikke brukes slik den er nå.");
  else if (s.f_drivable === "delvis") ex.push("Bilen kan bare brukes i begrenset grad, og jeg kan ikke stole på den i vanlig bruk.");
  const imp = s.f_impact
    .filter((k) => !(k === "stopp" && s.f_drivable === "nei") && !(k === "palitelig" && s.f_drivable === "delvis"))
    .map((k) => IMPACT.find((x) => x[0] === k)?.[4])
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (imp.length) ex.push(`Konsekvensen er at ${listJoin(imp)}.`);
  if (ex.length) B.push({ t: "p", tekst: [ex.join(" ")] });

  if (s.ws === "rapport" || s.ws === "uten") {
    let p = `Bilen er undersøkt av ${WS_WHO[s.ws_who] ?? "et verksted"}${has("ws_name") ? `, ${s.ws_name.trim()}` : ""}.`;
    if (s.ws === "rapport") {
      const says = s.ws_says.map((k) => WS_SAYS[k]).filter(Boolean);
      p += ` Verkstedrapporten${has("ws_date") ? ` datert ${fmtD(s.ws_date)}` : ""} ${says.length ? listJoin(says) : "beskriver feilen"}.`;
      if (has("ws_quote")) p += ` Rapportens konklusjon er: «${unquote(s.ws_quote)}».`;
      p += " Rapporten følger vedlagt.";
    }
    B.push({ t: "p", tekst: [p] });
  }
  if (s.seller_said === "lovet")
    B.push({ t: "p", tekst: [has("seller_txt") ? `Før kjøpet opplyste dere: «${unquote(s.seller_txt)}». Det er en del av avtalen, jf. ${L.lovRef("uriktig")}.` : `Før kjøpet ga dere uttrykk for at bilen var fri for slike feil. Det er en del av avtalen, jf. ${L.lovRef("uriktig")}.`] });
  if (s.f_prior) {
    const how = has("f_prior_how") ? ` ${s.f_prior_how === "oppmøte" ? "ved oppmøte" : `på ${s.f_prior_how}`}` : "";
    let p = `Jeg tok opp feilen med dere${how} ${has("f_prior_date") ? fmtD(s.f_prior_date) : "tidligere"}.`;
    if (has("f_prior_resp")) p += ` Svaret jeg fikk, var at ${trimDot(s.f_prior_resp)}.`;
    p += " Forholdet er ikke løst, og dette brevet bekrefter og utdyper reklamasjonen.";
    B.push({ t: "p", tekst: [p] });
  }

  B.push({ t: "h", tekst: ["Rettslig grunnlag"] });
  B.push({ t: "p", tekst: [`Etter ${L.lovRef("krav")} skal bilen være i samsvar med avtalen og ha de egenskapene jeg med rette kunne forvente. Når den ikke er det, foreligger det en mangel, jf. ${L.par("avvik")}.`] });
  // Before 2024 old § 17; from 2024 a general «som den er» is no agreed exception under § 15 annet ledd
  // (the wording the lawyer reviewed in the earlier letter).
  if (s.c_asis)
    B.push({
      t: "p",
      tekst: [
        L.versjon === "før_2024"
          ? `Bilen ble solgt «som den er». Etter ${L.lovRef("forbehold")} har bilen likevel en mangel når den er ${LOVORD.dårligereStand}.`
          : `Forbeholdet om at bilen ble solgt «som den er», er ikke et avtalt unntak etter ${L.lovRef("forbehold")}. Unntaket fra ${LOVORD.kravTredjeFjerde} forutsetter at jeg ved inngåelsen av avtalen ${LOVORD.avtaltUnntak}.`,
      ],
    });
  const del = parseD(s.c_delivery),
    found = parseD(s.f_found);
  const formodning = `Etter ${L.par("formodning")} skal en mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises.`;
  // Each fault on its own date, in calendar months as the law and the ranking count (tidsnivaFor):
  // the presumption only for the faults inside it, the five-year rule only between two and five years.
  // A fault in what the seller said or promised existed at the sale: no presumption for it.
  const datert = s.f_cats.map((c) => ({ c, d: s.f_area[c]?.found ?? "" })).filter((x) => x.d && s.c_delivery && x.d >= s.c_delivery && !opplysningsfeil(x.c, s.f_parts[x.c] ?? []));
  const ved = (xs: typeof datert) => listJoin(xs.map((x) => smaa(feilnavn(x.c, s.f_parts[x.c] ?? []))));
  if (s.c_delivery && datert.length) {
    const inne = datert.filter((x) => x.d <= plussManeder(s.c_delivery, L.formodningMnd));
    const sene = datert.filter((x) => x.d > plussManeder(s.c_delivery, 24) && x.d <= plussManeder(s.c_delivery, 60));
    const alene = datert.length === 1;
    if (inne.length) {
      const hvem = alene
        ? [`Feilen viste seg ${dur(del!, parseD(inne[0].d)!) || "samme dag"} etter overtakelsen.`, "feilen"]
        : inne.length === datert.length
          ? [`Feilene viste seg innen ${L.formodningTekst} etter overtakelsen.`, "feilene"]
          : [`${inne.length > 1 ? "Feilene" : "Feilen"} ved ${ved(inne)} viste seg innen ${L.formodningTekst} etter overtakelsen.`, inne.length > 1 ? "disse feilene" : "denne feilen"];
      B.push({ t: "p", tekst: [`${hvem[0]} ${formodning} Det er dermed dere som må bevise at ${hvem[1]} ikke var til stede da jeg overtok bilen.`] });
    }
    if (sene.length) {
      const hvem = alene ? `Feilen viste seg ${dur(del!, parseD(sene[0].d)!)} etter overtakelsen.` : `${sene.length > 1 ? "Feilene" : "Feilen"} ved ${ved(sene)} viste seg mer enn to år etter overtakelsen.`;
      B.push({ t: "p", tekst: [`${hvem} En bil er ment å vare vesentlig lenger enn to år, og reklamasjonsfristen er derfor fem år, jf. ${L.par("reklamasjon_5ar")}.`] });
    }
  } else if ((!del || !found) && !s.f_cats.every((c) => opplysningsfeil(c, s.f_parts[c] ?? []))) B.push({ t: "p", tekst: [`En mangel som viser seg innen ${L.formodningTekst} etter leveringen, formodes å ha eksistert ved leveringen, jf. ${L.par("formodning")}.`] });
  if (found) {
    const nr = (s.f_prior && parseD(s.f_prior_date)) || ld;
    const etterFemAr = !!del && nr > parseD(plussManeder(s.c_delivery, 60))!;
    // Timely only when it surely is: within two months of the discovery and five years of the handover,
    // and not dated before the discovery. Later than two months the letter claims nothing.
    if (!etterFemAr && nr >= found && nr <= addMonths(found, 2)) B.push({ t: "p", tekst: [`Reklamasjonen er fremsatt innen to måneder etter at jeg oppdaget feilen, og er dermed rettidig etter ${L.par("reklamasjon")}.`] });
  }
  // Not when the complaint is that the promised warranty is missing.
  if (s.c_warranty && !s.f_cats.includes("garanti")) B.push({ t: "p", tekst: ["Bilen er også omfattet av garanti. Garantien gjelder i tillegg til mine rettigheter etter loven og begrenser dem ikke."] });

  if (s.prec_on) {
    if (presedens === "venter") {
      B.push({ t: "h", tekst: ["Tilsvarende sak fra Forbrukerklageutvalget"] });
      B.push({ t: "p", tekst: [{ ph: "lignende sak hentes" }] });
    } else if (presedens) {
      B.push({ t: "h", tekst: [`Tilsvarende sak fra ${presedens.utvalg}`] });
      B.push({ t: "prec", avsnitt: [[presedens.avsnitt], ...(presedens.kildeUrl ? [[`Vedtaket er offentlig tilgjengelig: ${presedens.kildeUrl}`]] : [])] });
    } else B.push({ t: "p", tekst: [LOVSETNING] });
  }

  B.push({ t: "h", tekst: ["Mitt krav"] });
  const kjop: Del = has("c_price") ? s.c_price : { ph: "kjøpesum" };
  switch (s.k_main) {
    case "retting":
      B.push({ t: "p", tekst: [`Jeg krever at mangelen rettes, jf. ${L.par("retting")}. Rettingen skal skje uten kostnad for meg, innen rimelig tid og uten vesentlig ulempe for meg.${s.k_loaner ? " Jeg ber om at dere stiller lånebil til disposisjon mens bilen er til reparasjon." : ""}`] });
      break;
    case "omlevering":
      B.push({ t: "p", tekst: [`Jeg krever omlevering, det vil si en tilsvarende bil uten mangel, jf. ${L.par("retting")}. Omleveringen skal skje uten kostnad for meg og innen rimelig tid.`] });
      break;
    case "prisavslag":
      B.push({ t: "p", tekst: ["Jeg krever et forholdsmessig prisavslag på kr ", v("k_amount", "beløp"), `, jf. ${L.par("prisavslag")}.${has("k_basis") ? ` Beløpet bygger på ${trimDot(s.k_basis)}.` : ""}`] });
      break;
    case "heving":
      B.push({ t: "p", tekst: [`Mangelen er ikke uvesentlig, og jeg hever med dette kjøpet, jf. ${L.par("heving")}. Jeg krever kjøpesummen på kr `, kjop, " tilbakebetalt mot at bilen leveres tilbake til dere. Jeg ber om at dere tar kontakt for å avtale tilbakelevering og oppgjør."] });
      break;
    default:
      B.push({ t: "p", tekst: ["Jeg krever ", { ph: "velg krav i steg 4" }, "."] });
  }
  if ((s.k_main === "retting" || s.k_main === "omlevering") && (s.k_alt === "prisavslag" || s.k_alt === "heving"))
    B.push({ t: "p", tekst: [`Dersom ${s.k_main} ikke skjer innen rimelig tid, ikke lykkes eller ikke er mulig, krever jeg subsidiært ${s.k_alt === "prisavslag" ? `et forholdsmessig prisavslag, jf. ${L.par("prisavslag")}` : `å heve kjøpet, jf. ${L.par("heving")}`}.`] });
  if (s.k_exp) {
    const it = s.exp.filter((x) => x.t || x.a);
    B.push({ t: "p", tekst: [`I tillegg krever jeg erstatning for utgifter jeg har hatt som følge av mangelen, jf. ${L.par("erstatning")}${it.length ? ":" : ""}`, ...(it.length ? [] : [" ", { ph: "legg til utgiftene" }, "."])] });
    if (it.length) B.push({ t: "exp", rader: it.map((x) => [[x.t ? x.t : { ph: "utgift" }], kr(+x.a || 0)]), sum: kr(it.reduce((a, x) => a + (+x.a || 0), 0)) });
  }
  // § 28 (tilbakeholdsrett) is the same in both versions and not in the paragraph tables.
  if (s.k_hold) B.push({ t: "p", tekst: ["Inntil saken er løst, holder jeg tilbake kr ", v("k_hold_amt", "beløp"), " av det jeg skylder dere, jf. § 28."] });

  const dd: Del = s.k_days ? fmtD(addDays(ld, +s.k_days)) : { ph: "svarfrist" };
  const nxt = "bringe saken inn for Forbrukerrådet for mekling og eventuelt videre til Forbrukerklageutvalget";
  B.push({ t: "p", tekst: firm ? ["Jeg krever skriftlig svar innen ", dd, `. Hører jeg ikke fra dere innen fristen, vil jeg ${nxt}.`] : ["Jeg ber om en skriftlig tilbakemelding innen ", dd, ` med forslag til hvordan dere vil løse saken. Kommer vi ikke til enighet, vil jeg ${nxt}.`] });
  const att = [...s.f_docs.map((d) => DOCS.find((x) => x[0] === d)?.[1]).filter((x): x is NonNullable<typeof x> => !!x), ...s.files];
  if (att.length) {
    B.push({ t: "h", tekst: ["Vedlegg"] });
    B.push({ t: "ol", punkter: att.map((a) => [a]) });
  }
  B.push({ t: "sign", linjer: [["Med vennlig hilsen"], [""], [v("b_name", "Ditt navn")]] });
  return B;
}

const tekst = (d: Del[]) => d.map((x) => (typeof x === "string" ? x : "ph" in x ? `[${x.ph}]` : x.b)).join("");

// The letter as plain text for the clipboard, placeholders as «[…]».
export function tilTekst(B: Blokk[]): string {
  return B.map((b) => {
    switch (b.t) {
      case "addr":
      case "sign":
        return b.linjer.map(tekst).join("\n");
      case "prec":
        return b.avsnitt.map(tekst).join("\n\n");
      case "ul":
        return b.punkter.map((i) => `– ${tekst(i)}`).join("\n");
      case "ol":
        return b.punkter.map((i, n) => `${n + 1}. ${tekst(i)}`).join("\n");
      case "exp":
        return `${b.rader.map(([a, c]) => `– ${tekst(a)}: ${c}`).join("\n")}\nSum: ${b.sum}`;
      default:
        return tekst(b.tekst);
    }
  })
    .join("\n\n")
    .replace(/[  ]/g, " ");
}

export const emne = (B: Blokk[]) => {
  const s = B.find((b) => b.t === "subj");
  return s && "tekst" in s ? tekst(s.tekst) : "";
};

