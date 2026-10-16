// Numbers, lists and names as the ranking, the choice of decision and the pages write them.

const NB = new Intl.NumberFormat("nb-NO");

// 142000 → «142 000» (with a non-breaking space, so a figure never splits over two lines).
export const tall = (n: number) => NB.format(n);

// «a», «a og b», «a, b og c»
export const liste = (deler: string[]) => (deler.length < 2 ? (deler[0] ?? "") : `${deler.slice(0, -1).join(", ")} og ${deler.at(-1)}`);

// A name in the middle of a sentence starts in lower case, except an acronym («EGR, partikkelfilter»).
export const smaa = (s: string) => (/^[A-ZÆØÅ]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

// Brreg and the registry write place names in capitals: «OSLO» → «Oslo». Mixed case is left alone.
export const sted = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s);
