// Dates as the app handles them: ISO strings (YYYY-MM-DD) in local time, and the Norwegian wording of
// spans between them. Ported from the artifact.

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const idag = () => iso(new Date());

export function parseD(s?: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return y ? new Date(y, m - 1, d) : null;
}

export function fmtD(s: string | Date): string {
  const d = typeof s === "string" ? parseD(s) : s;
  return d ? d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);
export const monthsFrac = (a: Date, b: Date) => dayDiff(a, b) / 30.4375;

function monthsBetween(a: Date, b: Date): number {
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  return m;
}

// «2 måneder», «ett år og én måned»; empty when b is before a.
export function dur(a: Date, b: Date): string {
  const days = dayDiff(a, b);
  if (days < 0) return "";
  const m = monthsBetween(a, b);
  if (m < 1) return days === 1 ? "én dag" : `${days} dager`;
  const y = Math.floor(m / 12),
    r = m % 12;
  return [y ? (y === 1 ? "ett år" : `${y} år`) : "", r ? (r === 1 ? "én måned" : `${r} måneder`) : ""].filter(Boolean).join(" og ");
}

// «2 måneder og 2 uker etter overtakelsen», relative to the handover date when there is one.
export function relText(d: string, handover?: string): string {
  const del = parseD(handover),
    x = parseD(d);
  if (!x) return "Velg dato";
  if (!del) return fmtD(x);
  if (x < del) return "Før overtakelsen";
  let m = monthsBetween(del, x);
  const a = addMonths(del, m);
  const days = Math.round((x.getTime() - a.getTime()) / 864e5),
    w = Math.floor(days / 7);
  const n = (k: number, s: string, p: string) => (k === 1 ? `én ${s}` : `${k} ${p}`);
  const parts: string[] = [];
  if (m >= 12) {
    const y = Math.floor(m / 12);
    parts.push(y === 1 ? "ett år" : `${y} år`);
    m %= 12;
  }
  if (m) parts.push(n(m, "måned", "måneder"));
  if (w) parts.push(n(w, "uke", "uker"));
  else if (!parts.length && days) parts.push(n(days, "dag", "dager"));
  if (!parts.length) return "Samme dag som overtakelsen";
  return parts.join(parts.length > 2 ? ", " : " og ").replace(/, ([^,]+)$/, " og $1") + " etter overtakelsen";
}
