import type { Brevsak, Setning } from "./typer";

// Where the case goes if the seller does not answer. The complaints committee is administered by the
// Consumer Authority; the decisions the letter cites are the committee's.
export const INSTANS = "Forbrukerklageutvalget";

// 5. Frist for tilbakemelding. The reply address is the e-mail when Vipps has one, otherwise the
// telephone number. Without a buyer (before payment) there is no address to give.
export function frist(s: Brevsak): Setning[] {
  if (!s.kjoper) return [];
  const epost = s.kjoper.epost?.trim();
  return [
    {
      tekst: `Jeg ber om skriftlig svar til ${epost || `tlf. ${s.kjoper.telefon}`} innen 14 dager fra dette brevets dato.`,
      kilde: `vipps:${epost ? "epost" : "telefon"}; fast`,
    },
    { tekst: `Uten svar, eller ved avslag, vil saken bli brakt inn for ${INSTANS}.`, kilde: "fast" },
  ];
}
