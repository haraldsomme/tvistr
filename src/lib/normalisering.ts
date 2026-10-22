// Canonical forms so that counts and lookups across decisions are reliable.

const MERKER: Record<string, string[]> = {
  Volkswagen: ["vw", "volkswagen", "volkswagen ag", "folkevogn"],
  "Mercedes-Benz": ["mercedes", "mercedes benz", "mercedes-benz", "mb", "benz"],
  BMW: ["bmw"],
  Audi: ["audi"],
  Toyota: ["toyota"],
  Volvo: ["volvo"],
  Skoda: ["skoda", "škoda"],
  Ford: ["ford"],
  Opel: ["opel"],
  Peugeot: ["peugeot"],
  Citroën: ["citroen", "citroën"],
  Renault: ["renault"],
  Nissan: ["nissan"],
  Mazda: ["mazda"],
  Mitsubishi: ["mitsubishi"],
  Honda: ["honda"],
  Hyundai: ["hyundai"],
  Kia: ["kia"],
  Subaru: ["subaru"],
  Suzuki: ["suzuki"],
  Tesla: ["tesla"],
  Porsche: ["porsche"],
  "Land Rover": ["land rover", "landrover", "range rover"],
  Jaguar: ["jaguar"],
  Jeep: ["jeep"],
  Chevrolet: ["chevrolet", "chevy"],
  Chrysler: ["chrysler"],
  Dodge: ["dodge"],
  Fiat: ["fiat"],
  "Alfa Romeo": ["alfa romeo", "alfa"],
  Lexus: ["lexus"],
  Mini: ["mini", "mini cooper"],
  Seat: ["seat"],
  Cupra: ["cupra"],
  Saab: ["saab"],
  Dacia: ["dacia"],
  "DS": ["ds", "ds automobiles"],
  Polestar: ["polestar"],
  MG: ["mg", "mg motor"],
  BYD: ["byd"],
  Smart: ["smart"],
  Iveco: ["iveco"],
  "Harley-Davidson": ["harley davidson", "harley-davidson", "harley"],
  Yamaha: ["yamaha"],
  Kawasaki: ["kawasaki"],
  Ducati: ["ducati"],
  KTM: ["ktm"],
  Triumph: ["triumph"],
  Piaggio: ["piaggio", "vespa"],
  Hobby: ["hobby"],
  Adria: ["adria"],
  Knaus: ["knaus"],
  Tabbert: ["tabbert"],
  Kabe: ["kabe"],
  Dethleffs: ["dethleffs"],
  Hymer: ["hymer"],
  Bürstner: ["burstner", "bürstner"],
  Fendt: ["fendt"],
  "Solifer": ["solifer"],
};

const MERKE_ALIAS = new Map<string, string>();
for (const [kanonisk, alias] of Object.entries(MERKER)) for (const a of alias) MERKE_ALIAS.set(a, kanonisk);

export function normaliserMerke(merke: string | null | undefined): string | null {
  const t = merke?.trim();
  if (!t) return null;
  const nokkel = t.toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ");
  return MERKE_ALIAS.get(nokkel) ?? t.replace(/\s+/g, " ").replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

const SELSKAPSFORM = /\b(as|asa|ans|da|enk|sa|nuf|ab|gmbh|ltd|inc|ba|avd|avdeling)\b\.?/gi;

// "Bilsalg Øst AS" / "BILSALG ØST A/S" / "Bilsalg Øst, avd. Ski" → "bilsalg øst"
export function normaliserFirmanavn(navn: string | null | undefined): string | null {
  const t = navn?.trim();
  if (!t) return null;
  const n = t
    .toLowerCase()
    .replace(/a\/s/g, "as")
    .split(/,/)[0]
    .replace(SELSKAPSFORM, " ")
    .replace(/[^\p{L}\p{N}& ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return n || null;
}

// Norwegian organisation numbers are nine digits, often written "912 345 678".
export function normaliserOrgnr(orgnr: string | null | undefined): string | null {
  const d = orgnr?.replace(/\D/g, "");
  return d && d.length === 9 ? d : null;
}

const LOVPREFIKS: [RegExp, string][] = [
  [/forbrukerkjøpslov(?:en)?|fkjl\.?/i, "fkjl"],
  [/kjøpslov(?:en)?|kjl\.?/i, "kjl"],
  [/avhendingslov(?:a|en)?|avhl\.?/i, "avhl"],
  [/forbrukerklageutvalgslov(?:en)?|fkul\.?/i, "fkul"],
  [/forbrukertvistlov(?:en)?/i, "ftvl"],
  [/skadeserstatningslov(?:en)?|skl\.?/i, "skl"],
];

const HOVEDLOV = /forbrukerkjøpslov|fkjl|kjøpslov|kjl\b/i;
const LOVORD = /(?<![\p{L}])([\p{L}-]*lov(?:en|a)?)(?![\p{L}])/giu;

// "forsinkelsesrenteloven" → "forsinkelsesrl"-style prefix: the law word itself, lowercased and without article.
function annenLovPrefiks(ord: string): string {
  const navn = ord.toLowerCase().replace(/(en|a)$/, "");
  return /^forsin\p{L}*rente/u.test(navn) ? "forsinkelsesrentelov" : navn; // also fixes typos in the source text
}

// "forbrukerkjøpsloven § 16 første ledd bokstav b" → "fkjl § 16"; "§ 27" with lov=kjøpsloven → "kjl § 27";
// "forsinkelsesrenteloven § 3" keeps its own law ("forsinkelsesrentelov § 3"); "§§ 32 og 33" → two entries.
export function normaliserParagraf(p: string, lov: string | null): string[] {
  const treff = p.match(/§+\s*((?:\d+\s*[a-z]?(?![a-zæøå])\s*(?:,|og|og\/eller|-|–)?\s*)+)/i);
  if (!treff) return [];
  const nummer = [...treff[1].matchAll(/(\d+)\s*([a-z])?(?![a-zæøå])/gi)].map((m) => m[1] + (m[2] ?? ""));
  if (!nummer.length) return [];
  let prefiks = LOVPREFIKS.find(([re]) => re.test(p))?.[1] ?? null;
  if (!prefiks) {
    const ord = [...p.matchAll(LOVORD)].map((m) => m[1]).find((o) => !HOVEDLOV.test(o));
    if (ord) prefiks = annenLovPrefiks(ord);
  }
  prefiks ??= lov === "forbrukerkjøpsloven" ? "fkjl" : lov === "kjøpsloven" ? "kjl" : null;
  return nummer.map((nr) => (prefiks ? `${prefiks} § ${nr}` : `§ ${nr}`));
}

export function normaliserParagrafer(liste: string[] | null | undefined, lov: string | null): string[] | null {
  if (!liste?.length) return null;
  const ut = [...new Set(liste.flatMap((p) => normaliserParagraf(p, lov)))];
  return ut.length ? ut.sort((a, b) => a.localeCompare(b, "nb", { numeric: true })) : null;
}
