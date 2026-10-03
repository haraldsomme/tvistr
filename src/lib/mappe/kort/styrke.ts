import { andel, MIN_N, type Andel, type ForFa, type UtvalgTall } from "../typer";

export type StyrkeKort = {
  medhold: Andel | ForFa;
  fordeling: { fullt: number; delvis: number; avslag: number };
  beskrivelse: string;
  spesifikk: boolean;
  n: number;
};

export function styrkeKort(u: UtvalgTall): StyrkeKort {
  return {
    medhold: andel(u.fullt + u.delvis, u.n, MIN_N),
    fordeling: { fullt: u.fullt, delvis: u.delvis, avslag: u.avslag },
    beskrivelse: u.beskrivelse,
    spesifikk: u.spesifikk,
    n: u.n,
  };
}
