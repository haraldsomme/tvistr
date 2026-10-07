import { leggTilDager, PURRING_DAGER } from "@/lib/mappe/kort/videre";
import { iDag } from "@/lib/vurdering/faktorer";
import type { KlageInput } from "@/lib/vurdering/typer";
import { brevhode, norskDato, SVARFRIST_DAGER, type Brev } from "./brev";
import type { Utfylling } from "./utfylling";

// The reminder sent when the dealer has not answered by the deadline of the first letter. Same
// sender, recipient and car as the letter; only the subject line and the body differ.
// `input` is kept for the callers; the reminder needs only the parts around the paragraphs.
export function byggPurring(_input: KlageInput, idag = iDag(), u: Utfylling = {}): Brev {
  const grunn = brevhode(u, idag);
  const sendt = u.sendt ? norskDato(u.sendt) : "[dato for brevet]";
  const frist = u.sendt ? norskDato(leggTilDager(u.sendt, SVARFRIST_DAGER)) : "[svarfristen]";
  return {
    ...grunn,
    emne: grunn.emne.replace(/^Reklamasjon på mangel/, "Purring – reklamasjon på mangel"),
    avsnitt: [
      `Jeg viser til mitt reklamasjonsbrev av ${sendt} om ovennevnte bil. Fristen for å svare var ${frist}, og jeg har ikke mottatt svar som løser saken.`,
      `Jeg opprettholder kravet i brevet og gir dere en ny frist på ${PURRING_DAGER} dager, det vil si innen ${norskDato(leggTilDager(idag, PURRING_DAGER))}.`,
      "Får jeg ikke svar innen den fristen, vil jeg uten ytterligere varsel klage saken inn til Forbrukertilsynet for mekling og eventuelt behandling i Forbrukerklageutvalget.",
    ],
  };
}
