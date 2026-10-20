// The example letter on the landing page. The text is written here, not drawn from the letter the app
// writes (src/lib/app/brev.ts), and the case is made up: the buyer, the dealer and the decision it
// refers to. Words made of n's (nn–nnnnnn) are the censored parts: they are drawn as grey bars and
// are never read out.

export const TEKST = `Kari Nordmann
Storgata 12
0155 Oslo

Bilhuset Vest AS
Industriveien 4
1337 Sandvika

Oslo, 16. oktober 2026

**Reklamasjon på mangel ved Volkswagen Golf, reg.nr. AB 12345**

Jeg viser til mitt kjøp av brukt Volkswagen Golf, årsmodell 2022, reg.nr. AB 12345. Kjøpekontrakten ble inngått 20. juni 2026 til kr 259 900, og jeg overtok bilen 24. juni 2026 med en kilometerstand på 39 800 km. Bilen har en mangel, og jeg reklamerer med dette nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn.

**Mangelen**

Klimaanlegget (AC) sluttet å virke. Feilen ble oppdaget 30. september 2026. Anlegget blåser bare varm luft, og frontruta dugger igjen når det er fuktig ute. Verkstedet har funnet en defekt trykksensor i kjølekretsen, og anlegget kjøler derfor ikke. Konsekvensen er at nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn.

**Rettslig grunnlag**

Etter forbrukerkjøpsloven § 15 tredje ledd bokstav b skal bilen ha de egenskapene, blant annet med hensyn til holdbarhet og funksjonalitet, som er vanlige for biler av samme type, og som jeg med rimelighet kunne forvente. Bilen har dermed en mangel, jf. § 16 første ledd bokstav a.

Feilen viste seg tre måneder etter leveringen. Etter § 18 annet ledd skal en mangel som viser seg innen to år etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises. Det er dermed dere som må nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn.

**Praksis fra Forbrukerklageutvalget**

Det vises til Forbrukerklageutvalgets vedtak i sak 48213 av 9. juni 2025. Saken gjaldt svikt i klimaanlegget på en Volkswagen Golf 2021-modell kjøpt i 2024, som hadde gått 35 500 km ved kjøpet. Utvalget uttalte nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn.

**Krav**

Prinsipalt krever jeg retting av mangelen, jf. § 29 første ledd. Rettingen skal skje uten kostnad for meg, uten vesentlig ulempe og innen rimelig tid, jf. § 30 første ledd. Bilen stilles til rådighet for undersøkelse og utbedring etter nærmere avtale, jf. § 30 annet ledd. nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn.

Dersom retting ikke skjer innen rimelig tid, eller ikke lykkes, krever jeg subsidiært nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn.

Jeg ber om en skriftlig tilbakemelding innen 30. oktober 2026 med forslag til hvordan dere vil løse saken. nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn.

Med vennlig hilsen
Kari Nordmann

**Vedlegg**

Kjøpekontrakt · Verkstedrapport · Overslag på utbedring · nnnnnn nnnnnn nnnnnn nnnnnn nn`;

export type Merke = 1 | 2 | 3 | 4 | 5 | 6;

// A piece of a line: legible text, or a censored run.
export type Del = { sladd: boolean; t: string };

export type Rad =
  | { rad: "adresser"; a: string[]; b: string[]; merke: Merke }
  | { rad: "dato" | "emne" | "overskrift" | "avsnitt" | "hilsen"; deler: Del[]; merke?: Merke };

// The six points beside the sheet (page.tsx) and where each begins: point 1 sits by the addresses.
const MERKER: [RegExp, Merke][] = [
  [/^Mangelen$/, 2],
  [/^Rettslig grunnlag$/, 3],
  [/^Praksis fra /, 4],
  [/^Krav$/, 5],
  [/^Jeg ber om en skriftlig tilbakemelding/, 6],
];

const SLADD = /(?<![\p{L}\d])n{2,6}(?: n{2,6})*(?![\p{L}\d])/gu;

export function deler(tekst: string): Del[] {
  const ut: Del[] = [];
  let sist = 0;
  for (const m of tekst.matchAll(SLADD)) {
    if (m.index > sist) ut.push({ sladd: false, t: tekst.slice(sist, m.index) });
    ut.push({ sladd: true, t: m[0] });
    sist = m.index + m[0].length;
  }
  if (sist < tekst.length) ut.push({ sladd: false, t: tekst.slice(sist) });
  return ut;
}

// The sheet's rows, in the letter's order.
export function eksempelRader(tekst = TEKST): Rad[] {
  const blokker = tekst.split("\n\n");
  const rader: Rad[] = [{ rad: "adresser", a: blokker[0].split("\n"), b: blokker[1].split("\n"), merke: 1 }, { rad: "dato", deler: deler(blokker[2]) }];
  for (const b of blokker.slice(3)) {
    const fet = b.match(/^\*\*(.+)\*\*$/);
    const t = fet ? fet[1] : b;
    const merke = MERKER.find(([re]) => re.test(t))?.[1];
    if (fet) rader.push({ rad: rader.length === 2 ? "emne" : "overskrift", deler: deler(t), merke });
    else rader.push({ rad: b.startsWith("Med vennlig hilsen") ? "hilsen" : "avsnitt", deler: deler(t), merke });
  }
  return rader;
}

// The legible text of each row, with the censored runs left out, for the test.
export const synligTekst = (r: Rad[]) => r.flatMap((x) => (x.rad === "adresser" ? [...x.a, ...x.b] : [x.deler.filter((d) => !d.sladd).map((d) => d.t).join("")]));
