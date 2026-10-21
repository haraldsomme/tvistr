// When the paid case looks up its decisions (finnVedtak): each new key costs one of the case's model
// calls, so not while the buyer is typing in a row that changes it, and not again for a list already
// shown. A failed call is tried again only on «Prøv igjen».
export const VENT_MS = 800;

export function skalHente({ aktiv, harSvar, precOn, sistHentet, nokkel }: { aktiv: boolean; harSvar: boolean; precOn: boolean; sistHentet: string | null; nokkel: string }): boolean {
  return aktiv && harSvar && precOn && sistHentet !== nokkel;
}
