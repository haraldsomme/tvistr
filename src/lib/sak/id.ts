// The short ids of cases and orders: 12 characters from 32 that cannot be misread (no 0/o, 1/l), 60
// random bits. 256 is a multiple of 32, so every character is equally likely.
const TEGN = "abcdefghijkmnpqrstuvwxyz23456789";
const LENGDE = 12;

export function nyId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(LENGDE)), (b) => TEGN[b % TEGN.length]).join("");
}

export const erId = (x: unknown): x is string => typeof x === "string" && /^[a-km-np-z2-9]{12}$/.test(x);
