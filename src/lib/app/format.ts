// How the form formats what is typed (artifact FMT), and the plate check.
const digits = (s: string) => s.replace(/\D/g, "");
const NB = new Intl.NumberFormat("nb-NO");

export const FMT = {
  zip: (v: string) => digits(v).slice(0, 4),
  year: (v: string) => digits(v).slice(0, 4),
  num: (v: string) => {
    const d = digits(v).slice(0, 9);
    return d ? NB.format(+d) : "";
  },
  org: (v: string) => digits(v).slice(0, 9).replace(/(\d{3})(?=\d)/g, "$1 "),
  phone: (v: string) => {
    const d = digits(v).slice(0, 8);
    if (d.length < 8) return d;
    return /^[49]/.test(d) ? d.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3") : d.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
  },
  reg: (v: string) => {
    const c = v.toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, "").slice(0, 9);
    const m = c.match(/^([A-ZÆØÅ]{2})(\d{1,5})$/);
    return m ? `${m[1]} ${m[2]}` : c;
  },
};
export type Format = keyof typeof FMT;

export const validReg = (v: string | undefined) => /^[A-ZÆØÅ]{2} \d{4,5}$/.test(v ?? "");

// Mod 11 check of a Norwegian organisation number: null while incomplete.
export function orgValid(o: string): boolean | null {
  const d = digits(o);
  if (d.length !== 9) return null;
  const w = [3, 2, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 8; i++) s += +d[i] * w[i];
  let c = 11 - (s % 11);
  if (c === 11) c = 0;
  if (c === 10) return false;
  return c === +d[8];
}

export const tall = (n: number) => NB.format(n);
export const listJoin = (a: string[]) => (a.length < 2 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} og ${a[a.length - 1]}`);
export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const lcFirst = (x: string) => (/^[A-ZÆØÅ0-9]{2}/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1));
