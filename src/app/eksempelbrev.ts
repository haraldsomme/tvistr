import { type Blokk, byggBrev, type Presedens, tilTekst } from "@/lib/app/brev";
import { addDays, iso, parseD } from "@/lib/app/dato";
import { eksempel, type Skjema, syncAreas } from "@/lib/app/skjema";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import { avsnittA, type Malvedtak } from "@/lib/vedtaksvalg/mal";

// The example letter on the landing page. The sheet is drawn from the blocks the letter writes for the
// example case (byggBrev), never from text written here; `SEKSJONER` only says how far each section is
// legible before it is censored (eksempelbrev.test.ts checks it against the letter).
// The buyer is made up. The decision is real: 22/10322 of 1 June 2023, as it stands in the table
// `vedtak` (id 1869): a VW Golf 2017 whose air-conditioning sensors failed; the dealer pointed to the
// expired warranty, the committee found a manufacturing fault and granted a price reduction. Its number,
// date, link and the two quotes are copied from there (avgjorende-v5, checked against the full text on
// import). It is also what the ranking picks first for this case, at level A with 25 of 25 points
// (checked against the table when the example was made).

export const VEDTAK_URL = "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023030866&dokid=902671&versjon=1&variant=A&";

const SITATER = [
  "Basert på e-postene fra Gumpens Auto Grenland AS, legger utvalget til grunn som sannsynliggjort at den påberopte feilen skyldes en fabrikasjonsfeil.",
  "Etter utvalgets syn svarer bilen da ikke til det som forbrukeren har grunn til å forvente når det gjelder holdbarhet og andre egenskaper.",
];

const VEDTAK: Malvedtak = {
  utvalg: "Forbrukerklageutvalget",
  saksnummer: "22/10322",
  vedtaksdato: "2023-06-01",
  bil: "Volkswagen Golf 2017-modell",
  merke: "Volkswagen",
  modell: "Golf",
  arsmodell: 2017,
  km: 35500,
  alder: 4,
  somDenEr: false,
};

const KOMPONENT = "sensorer klimaanlegg";

// The buyer's car as the ranking saw it (39 800 km, four years, not sold «som den er», claim: prisavslag).
const KJOPER = { km: 39800, alder: 4, somDenEr: false };

// How the ranking compared the two cases: every side equal, and the decision gave the claimed remedy.
const treff = Object.fromEntries((["underkategori", "tidsniva", "km", "alder", "som_den_er", "krav", "egen_vurdering", "grunnlag"] as Kriterium[]).map((k) => [k, "likt"])) as Record<Kriterium, Treff>;

export function eksempelPresedens(): Presedens {
  return {
    id: 1869,
    saksnummer: VEDTAK.saksnummer,
    vedtaksdato: VEDTAK.vedtaksdato,
    bil: VEDTAK.bil!,
    utfall: ["prisavslag"],
    avsnitt: avsnittA(VEDTAK, KOMPONENT, SITATER, ["prisavslag"], KJOPER),
    kildeUrl: VEDTAK_URL,
    utvalg: VEDTAK.utvalg,
    anbefalt: true,
    niva: "A",
    gjaldt: KOMPONENT,
    km: VEDTAK.km,
    alder: VEDTAK.alder,
    somDenEr: VEDTAK.somDenEr,
    likhet: 100,
    treff,
  };
}

export const IDAG = "2026-10-16";
export const DATO = "Oslo, 16. oktober 2026";
export const EMNE = "Reklamasjon på mangel ved Volkswagen Golf, reg.nr. AB 12345";

// The made-up case: the air conditioning of a four-year-old Golf stops cooling, the dealer answers «wear»
// and «the warranty has expired», and the buyer claims a price reduction equal to the repair quote.
// Phone, e-mail and organisation number are left out, as they are optional in the form, so the two
// addresses stay short side by side.
export function forsideSak(idag = IDAG): Skjema {
  const t = parseD(idag)!;
  const d = (n: number) => iso(addDays(t, -n));
  return syncAreas({
    ...eksempel(idag),
    b_phone: "", b_email: "", d_org: "", d_contact: "", d_email: "",
    c_make: "Volkswagen", c_model: "Golf", c_year: "2022", c_reg: "AB 12345",
    c_purchase: d(118), c_delivery: d(114), c_price: "259 900", c_km: "39 800", c_asis: false, c_warranty: false,
    f_cats: ["klima"], f_parts: { klima: ["ac"] },
    f_area: { klima: { found: d(16), impact: ["bruk"], known: "nei" } },
    f_catdesc: { klima: "Klimaanlegget blåser bare varm luft, og frontruta dugger igjen når det er fuktig ute" },
    f_desc: "Verkstedet har funnet en defekt trykksensor i kjølekretsen, og anlegget kjøler derfor ikke",
    ws: "rapport", ws_who: "merke", ws_name: "Volkswagen-verkstedet i Sandvika", ws_date: d(9), ws_says: ["bekrefter", "aarsak", "ikke_slitasje", "kostnad"], ws_quote: "",
    seller_said: "", seller_txt: "",
    f_prior: true, f_prior_date: d(12), f_prior_how: "telefon", f_prior_resp: "", f_prior_svar: ["slitasje", "garanti_ute"],
    f_docs: ["kontrakt", "verksted", "korr"],
    k_main: "prisavslag", k_alt: "ingen", k_amount: "12 900", k_basis: "", k_cost: "12 900", k_forsok: "0",
    k_loaner: false, k_exp: true, exp: [{ t: "Feilsøking hos merkeverksted", a: 1890 }],
    l_place: "Oslo", l_date: idag,
  });
}

export const eksempelBlokker = (): Blokk[] => byggBrev(forsideSak(), eksempelPresedens(), IDAG);

export type Merke = 1 | 2 | 3 | 4 | 5 | 6;

// The six sections the points beside the sheet name. Each is drawn as one paragraph (under its heading,
// where the letter has one): its blocks' text run together, legible up to and including `til`, and the
// rest censored at the bottom, at most two lines. A section runs from its first block to the next
// section's first block; the last ends at the signature.
// `utelat`: sentences the simplified example leaves out of the legible part (they stay in the letter).
export type Seksjon = { merke: Merke; start: (b: Blokk) => boolean; til: string; utelat?: string[] };

const tekst = (b: Blokk) => tilTekst([b]);
const type = (t: Blokk["t"], start: string) => (b: Blokk) => b.t === t && tekst(b).startsWith(start);

export const SEKSJONER: Seksjon[] = [
  { merke: 1, start: type("p", "Jeg viser til mitt kjøp"), til: "jeg reklamerer med dette" },
  { merke: 2, start: type("h", "Mangelen"), til: "Konsekvensen er at" },
  { merke: 3, start: type("h", "Rettslig grunnlag"), til: "Det er dermed dere som må", utelat: ["Når den ikke er det, foreligger det en mangel, jf. § 16 første ledd bokstav a."] },
  { merke: 4, start: type("h", "Praksis fra"), til: "ved kjøpet. Utvalget uttalte" },
  { merke: 5, start: type("h", "Krav"), til: "Skjer ikke det, fastholder jeg kravet om" },
  { merke: 6, start: type("p", "Jeg ber om en skriftlig tilbakemelding"), til: "hvordan dere vil løse saken." },
];

// The censored bottom of a section: `kort` characters always, `bred` more where the sheet is wide, so
// the grey lines stay within two lines at any width.
export const SLADD = { kort: 30, bred: 30 };

export type Rad =
  // A block shown as the letter writes it, before the first section and after the last.
  | { rad: "blokk"; blokk: Blokk }
  // The first section has no heading; its marker sits by the addresses, where who and when begin.
  | { rad: "adresser"; a: Blokk; b: Blokk; merke?: Merke }
  // `kilde`: the letter's text the section stands for (the test joins it back into the letter).
  | { rad: "seksjon"; merke: Merke; visMerke: boolean; overskrift: string | null; tekst: string; skjult: { kort: number; bred: number }; kilde: string };

// A section's blocks run together: the list item's dash and the line breaks go.
const lopende = (B: Blokk[]) => B.map((b) => tekst(b).replace(/^– /gm, "").replace(/\s*\n+\s*/g, " ")).join(" ");

// The filler a censored run is drawn with: word-long pieces, so the lines break as text does. The
// letter's words are never on the page.
export const fyll = (n: number) => {
  const ord: string[] = [];
  for (let igjen = n; igjen > 0; igjen -= 7) ord.push("n".repeat(Math.max(2, Math.min(6, igjen - 1))));
  return ord.join(" ");
};

// The sheet's rows, in the letter's order.
export function eksempelRader(B: Blokk[] = eksempelBlokker()): Rad[] {
  const starter = SEKSJONER.map((s) => B.findIndex(s.start));
  const signatur = B.findIndex((b) => b.t === "sign");
  if ([...starter, signatur].some((i) => i < 0)) throw new Error("Eksempelbrevet mangler en seksjon");
  const rader: Rad[] = [];
  const enkelt = (fra: number, til: number) => {
    for (let i = fra; i < til; i++) {
      if (B[i].t === "addr" && B[i + 1]?.t === "addr") rader.push({ rad: "adresser", a: B[i], b: B[++i], merke: i === 1 ? 1 : undefined });
      else rader.push({ rad: "blokk", blokk: B[i] });
    }
  };
  enkelt(0, starter[0]);
  SEKSJONER.forEach((s, n) => {
    const blokker = B.slice(starter[n], n + 1 < starter.length ? starter[n + 1] : signatur);
    const overskrift = blokker[0].t === "h" ? tekst(blokker[0]) : null;
    const lop = (s.utelat ?? []).reduce((t, u) => t.replace(` ${u}`, ""), lopende(overskrift ? blokker.slice(1) : blokker));
    const slutt = lop.indexOf(s.til);
    if (slutt < 0) throw new Error(`Seksjon ${s.merke}: finner ikke «${s.til}»`);
    const synlig = lop.slice(0, slutt + s.til.length);
    const rest = lop.slice(synlig.length).trim().length;
    const kort = Math.min(SLADD.kort, rest);
    rader.push({ rad: "seksjon", merke: s.merke, visMerke: s.merke !== 1, overskrift, tekst: synlig, skjult: { kort, bred: Math.min(SLADD.bred, rest - kort) }, kilde: blokker.map(tekst).join("\n\n") });
  });
  enkelt(signatur, B.length);
  return rader;
}

// The letter's text each row stands for, in order.
export const kilder = (rader: Rad[]) => rader.map((r) => (r.rad === "adresser" ? `${tekst(r.a)}\n\n${tekst(r.b)}` : r.rad === "blokk" ? tekst(r.blokk) : r.kilde));

// The text of what is legible on the sheet, for the test.
export const synligTekst = (rader: Rad[]) =>
  rader.flatMap((r) => (r.rad === "adresser" ? [tekst(r.a), tekst(r.b)] : r.rad === "blokk" ? [tekst(r.blokk)] : [...(r.overskrift ? [r.overskrift] : []), r.tekst]));
