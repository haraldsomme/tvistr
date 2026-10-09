// Whether the seller's written statement is concrete (docs/spor.md): only then does it give track A.
// Tuned for precision on «specific», because a false A paragraph is worse than a missing one: a
// statement is specific when it names a component and says nothing general about the whole car.
// Measured against pass 2's labelled statements with `npm run spesifikk`.
import KOMPONENTORD from "./komponentord.json";

// Words in pass 2's komponenter[] that are about the car as a whole, its state, or nothing at all.
export const IKKE_KOMPONENT = new Set(
  (
    "bil bilen biler bilens kjøretøy kjøretøyet stand tilstand feil feilen mangler mangel skade skader generell generelt " +
    "god godt pen pent ny nye nytt gammel original diverse annet annen andre del deler delen alt alle hele helt teknisk tekniske " +
    "og i på av til med for som er var har den det de en et ikke uten fra om ved ett to tre over under etter før mellom samt eller " +
    "type modell utstyr ekstrautstyr standard funksjon funksjoner system systemet arbeid reparasjon reparasjoner verksted verkstedet " +
    "kjøring bruk slitasje problem problemer fører side foran bak venstre høyre " +
    "innvendig utvendig innvendige utvendige interiør eksteriør kjørekomfort kvalitetsfølelse utstyrt vedlikehold vedlikeholdt brukt slitt " +
    "kjørelengde alder plass kjøreegenskaper drivstofforbruk forbruk veien pris pengene tilstandsrapport kvalitet komfort trygghet stabilitet " +
    "farge fargekombinasjon kjøre familiebil bruksbil arbeidshest"
  ).split(" "),
);

// Components under the length limit of the list.
const KORTE = new Set(["eu", "ac", "hk", "abs", "awd", "dpf", "egr", "esp", "led"]);
// Concrete facts the form asks about that are no car part, so pass 2 has no components for them:
// liens, import, owners, collisions (heftelse_pant, bruktimport_opplysning, kollisjonsskade).
const FAKTA = ["heftelse", "heftelser", "pant", "import", "importert", "eier", "eiere", "kollisjon"];

// Phrases about the whole car; a statement with one is general even when it names a part («Dekk ser bra ut»).
const GENERELL = new RegExp(
  [
    "god stand", "topp ?stand", "meget god", "velholdt", "velstelt", "strøken", "feilfri", "(ingen|uten) (kjente )?feil", "feil (og|eller) mangler",
    "ser (bra|fin|pen|godt) ut", "alt fungerer", "som den (er|står)", "som forevist", "bruksmerker", "preg av", "ivaretatt", "tatt vare på",
    "ryddig", "nydelig", "eksemplar", "påkostet", "fremstår", "selges(?! (med|fri|ferdig))", "til salgs", "meget pen", "pen og", "grei", "trygg", "vedlikeholdt", "klar",
    "pen bil", "hel og (pen|fin)", "normalt? slitasje", "som ny", "mye utst[a-zæøå]*", "topp utstyrt", "går (meget |veldig )?(bra|fint)", "(godt )?brukt",
    "slitt", "dårlig", "ingenting å utsette", "flott", "sitter godt", "mulig at", "forventes", "kjørt langt", "fin (invendig|innvendig|utvendig)",
  ]
    // Letter boundaries, not \b: in JavaScript \b does not count æ, ø and å as letters («tatt vare på»).
    .map((p) => `(?<![a-zæøå])(?:${p})(?![a-zæøå])`)
    .join("|"),
  "i",
);

const KOMPONENTER = new Set<string>([...KOMPONENTORD, ...FAKTA]);
const LANGE = [...KOMPONENTER].filter((k) => k.length >= 4);

// A compound counts by its last part, where Norwegian puts the head: «vinterdekk», «regreim».
const erKomponent = (ord: string) => KOMPONENTER.has(ord) || KORTE.has(ord) || LANGE.some((k) => ord.length > k.length && ord.endsWith(k));

export function erSpesifikk(avskrift: string): boolean {
  if (GENERELL.test(avskrift)) return false;
  if (/\bkm\b/i.test(avskrift)) return true;
  return (avskrift.toLowerCase().match(/[a-zæøå]+/g) ?? []).some(erKomponent);
}
