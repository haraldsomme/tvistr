import type { Brevplan } from "./brevplan";
import { sakForModell, type Saksmodell } from "./saksmodell";

// What a letter was written from: the case as the author saw it and the plan. When it changes, the
// letter is out of date. Not a security hash; the same on the server and in the browser. The prompt
// version is left out: a better prompt does not make the buyer's letter wrong.
export function grunnlagFor(m: Saksmodell, plan: Brevplan): string {
  const tekst = JSON.stringify({ sak: sakForModell(m), kilder: m.kilder, argumenter: plan.argumenter, forbudt: plan.forbudt, mangler: plan.mangler, henvisning: plan.henvisning, merker: plan.merker });
  // cyrb53: two 32-bit FNV-like lanes, 53 bits out.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
