// The assessment screen as plain text: every sentence the buyer reads before the paywall, in the order
// of the screen. Used for the forbidden-word test and for the jurist's review (npm run vurdering:gylne).
import { PRIS } from "@/lib/pris";
import { liste, tall } from "@/lib/brev/format";
import { fristenUteTekst, OVERSKRIFT, tallsetninger, utenNivaA, type VurderingResultat } from "./vurdering";

const IKON = { ja: "✓", nei: "!", info: "i" } as const;

export function vurderingSomTekst(v: VurderingResultat, kjopsdato: string): string {
  if (v.status === "ute") return [`# ${OVERSKRIFT.ute}`, fristenUteTekst(kjopsdato), "[Gå til Forbrukerrådet] [Endre kjøpsdato]", "Du har ikke betalt noe."].join("\n\n");
  const deler: string[] = [`# ${OVERSKRIFT[v.status]}`];
  deler.push("## Dette sier loven om din sak", v.lovlinjer.map((l) => `${IKON[l.ikon]} ${l.tekst}${l.paragraf ? ` [${l.paragraf}]` : ""}`).join("\n"));
  deler.push("## Lignende saker i Forbrukerklageutvalget", ...v.tall.map((b) => tallsetninger(b).join(" ")));
  if (v.kort.length)
    deler.push(
      "Saker som ligner din:",
      v.kort.map((k) => `- ${[k.saksnummer && `Sak ${k.saksnummer}`, k.ar].filter(Boolean).join(" · ")}: ${k.bil}${k.km !== null ? `, ${tall(k.km)} km ved kjøp` : ""}${k.somDenEr ? ", «som den er»" : ""}${k.fikk.length ? ` – ${liste(k.fikk)}` : ""}`).join("\n"),
      ...(v.sammenligning ? [`✓ ${v.sammenligning}`] : []),
    );
  else deler.push(`§ ${utenNivaA(v.poeng)}`);
  deler.push(
    "## Dette får du",
    [
      `Reklamasjonsbrev etter forbrukerkjøpsloven ${v.lovversjon === "før_2024" ? "før 2024" : "fra 2024"}, klart til å sende`,
      ...(v.kort.length ? ["Henvisning til et vedtak der kjøperen fikk medhold for samme feil, med ordrette sitater fra utvalget"] : v.poeng.length ? [`Henvisning til et vedtak om ${v.poeng[0]}, med ordrette sitater fra utvalget`] : []),
      "Kravet (retting, prisavslag eller heving) formulert med riktig hjemmel",
      "Frist og hva som skjer hvis selger ikke svarer",
      "Word-fil og kopierbar tekst",
    ]
      .map((p) => `- ${p}`)
      .join("\n"),
    `${PRIS} kr. Betal når brevet er klart, ikke nå.`,
    "Tre korte steg til: dokumentasjon, krav og hvem selger er. Du betaler når du har sett sakens bakgrunn og vedtaket brevet bygger på.",
    "Tjenesten gir ikke juridisk rådgivning. Vurderingen bygger på svarene dine og på publiserte vedtak.",
  );
  return deler.join("\n\n");
}
