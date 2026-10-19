import type { Metadata } from "next";
import Link from "next/link";
import { Juridisk } from "@/app/deler/juridisk";
import { tall } from "@/lib/app/format";
import { FIRMA } from "@/lib/firma";
import { GRATIS, NYTT_KJOP, PRIS } from "@/lib/pris";
import { LAGRES_AR } from "@/lib/sak/lagringstid";

export const metadata: Metadata = { title: "Vilkår – Tvistr" };

// The terms of sale. Every promise here must hold in the code: the price (pris.ts), the consent at
// payment (kjop.tsx), the lock on car and faults, and the deletion (src/lib/sak/sletting.ts). In the
// trial (GRATIS) nothing is sold, so price, payment and the right of withdrawal are left out.
export default function Vilkar() {
  return (
    <Juridisk tittel={GRATIS ? "Vilkår for bruk" : "Vilkår for kjøp"} oppdatert="19. oktober 2026">
      <div className="jur-kort">
        <ul>
          {GRATIS ? (
            <li>Brevet er gratis i en prøveperiode.</li>
          ) : (
            <>
              <li>Du betaler kr {tall(PRIS)} én gang for brevet til én sak.</li>
              <li>Brevet åpnes med en gang. Derfor gir du fra deg angreretten når du kjøper.</li>
            </>
          )}
          <li>Brevet er en mal og ikke juridisk rådgivning. Vi kan ikke love et bestemt utfall.</li>
        </ul>
      </div>

      <h2>{GRATIS ? "Hvem som leverer tjenesten" : "Hvem du kjøper av"}</h2>
      <p>
        Tvistr leveres av {FIRMA.navn}, et {FIRMA.form} med org.nr. {FIRMA.orgnr}, {FIRMA.adresse}. Du når oss på <a href={`mailto:${FIRMA.epost}`}>{FIRMA.epost}</a>.
      </p>

      <h2>{GRATIS ? "Hva du får" : "Hva du kjøper"}</h2>
      <p>Du {GRATIS ? "får" : "kjøper"} tilgang til brevet for én sak: bilen og feilene du valgte i saksvurderingen. Der fyller du inn opplysningene og får et reklamasjonsbrev som du kopierer og sender selv. Vi sender ikke brevet for deg.</p>
      <p>Brevet viser til et vedtak fra Forbrukerklageutvalget eller Forbrukertvistutvalget når vi finner et som passer saken din. Finner vi ikke det, bygger brevet på lovens vilkår.</p>
      <p>
        Bilen og feilene kan ikke endres {GRATIS ? "etter at brevet er åpnet" : "etter kjøpet"}. Et brev for en annen bil eller andre feil krever {NYTT_KJOP}.
      </p>

      {GRATIS ? (
        <>
          <h2>Pris</h2>
          <p>Brevet er gratis i en prøveperiode. Saker du har åpnet, forblir gratis når prøveperioden slutter.</p>
        </>
      ) : (
        <>
          <h2>Pris og betaling</h2>
          <p>
            Prisen er kr {tall(PRIS)} som et engangsbeløp. Det er ikke et abonnement, og det kommer ingen andre kostnader. {FIRMA.navn} er ikke registrert i Merverdiavgiftsregisteret, så prisen er uten merverdiavgift. Du betaler med Vipps.
          </p>
        </>
      )}

      <h2>Levering</h2>
      <p>Brevet åpnes {GRATIS ? "når du trykker «Åpne brevet»" : "så snart betalingen er gjennomført"}. Saken åpnes når du er logget inn med den Vipps-kontoen som {GRATIS ? "åpnet brevet" : "betalte"}. Du finner alle sakene dine på Min side.{!GRATIS && " Du får kvitteringen og lenken på e-post til adressen du deler i Vipps. Lenken i e-posten ber om den innloggingen."}</p>
      <p>
        Saken er tilgjengelig i {LAGRES_AR} år etter {GRATIS ? "at du åpnet brevet" : "kjøpet"}. Deretter slettes den, se <Link href="/personvern">personvernerklæringen</Link>.
      </p>

      {!GRATIS && (
        <>
          <h2>Angrerett</h2>
          <p>Ved kjøp på nett har du normalt 14 dagers angrerett. Brevet er digitalt innhold som leveres med en gang. Når du kjøper, ber du derfor om at leveringen starter straks, og bekrefter at angreretten går tapt når brevet åpnes (angrerettloven § 22 bokstav n). Uten dette samtykket kan du ikke fullføre kjøpet.</p>
        </>
      )}

      <h2>Hva tjenesten er, og hva den ikke er</h2>
      <p>Saksvurderingen og brevet bygger på svarene dine, på forbrukerkjøpsloven og på publiserte vedtak. Tvistr er ikke juridisk rådgivning. Hver sak vurderes konkret av forhandleren og eventuelt av Forbrukerklageutvalget eller domstolene, så vi kan ikke love at du får medhold.</p>
      <p>Du er selv ansvarlig for at opplysningene du gir, stemmer, og for hva du sender. Les brevet før du sender det. Er saken stor eller uvanlig, bør du snakke med Forbrukerrådet eller en advokat.</p>

      <h2>Hvis noe er galt med tjenesten</h2>
      <p>
        Virker ikke brevet slik det er beskrevet, sier du fra til <a href={`mailto:${FIRMA.epost}`}>{FIRMA.epost}</a> innen rimelig tid. {GRATIS ? "Vi retter feilen." : "Vi retter feilen, og lykkes ikke det, får du pengene tilbake. Du har i tillegg rettighetene dine etter forbrukerkjøpsloven."}
      </p>

      <h2>Ansvar</h2>
      <p>Vi er ikke ansvarlige for utfallet av reklamasjonen din eller for hvordan forhandleren svarer. Dette begrenser ikke rettigheter du har etter lov som ikke kan avtales bort.</p>

      <h2>Personopplysninger</h2>
      <p>
        Hvordan vi behandler opplysningene dine, står i <Link href="/personvern">personvernerklæringen</Link>.
      </p>

      <h2>Endringer</h2>
      <p>Vi kan endre vilkårene. {GRATIS ? "Saken din følger vilkårene som gjaldt da du åpnet brevet." : "Kjøpet ditt følger vilkårene som gjaldt da du kjøpte."}</p>
    </Juridisk>
  );
}
