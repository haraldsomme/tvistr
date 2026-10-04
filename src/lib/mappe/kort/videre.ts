import { SVARFRIST_DAGER } from "@/lib/brev/brev";
import type { Utfylling } from "@/lib/brev/utfylling";
import { TID_TIL_VEDTAK } from "@/lib/vurdering/tid";

export type Steg = { dato: string | null; tittel: string; tekst: string };
export type VidereKort = { frist: string; steg: Steg[]; ventetid: string };

export const PURRING_DAGER = 7;

export function leggTilDager(iso: string, dager: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

// What happens after the letter is sent. What to say when the dealer answers is in motsvar.ts (brev).
export function videreKort(u: Utfylling, idag: string): VidereKort {
  const brevdato = u.sendt ?? idag;
  const frist = leggTilDager(brevdato, SVARFRIST_DAGER);
  const steg: Steg[] = [
    {
      dato: u.sendt ?? null,
      tittel: "Send brevet",
      tekst: "Send det skriftlig og behold dokumentasjon på at det er sendt (e-post med lesebekreftelse, eller rekommandert brev). Fyll inn datoen du sendte det under, så får du en purring med riktige datoer.",
    },
    { dato: frist, tittel: "Svarfrist for forhandleren", tekst: `Brevet gir forhandleren ${SVARFRIST_DAGER} dager til å svare.` },
    {
      dato: null,
      tittel: "Ingen svar eller avvist",
      tekst: `Send purringen, med ${PURRING_DAGER} dager til ny frist. Svarer forhandleren fortsatt ikke, eller avviser kravet, kan du bringe saken inn for Forbrukerklageutvalget.`,
    },
    { dato: null, tittel: "Forbrukerklageutvalget", tekst: "Se forbrukertilsynet.no for hvordan du klager. Ta med brevet, svaret fra forhandleren og dokumentasjonen." },
  ];
  return { frist, steg, ventetid: TID_TIL_VEDTAK };
}
