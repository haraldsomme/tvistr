import type { Metadata } from "next";
import { Juridisk } from "@/app/deler/juridisk";
import { FIRMA } from "@/lib/firma";
import { GRATIS } from "@/lib/pris";
import { LAGRES_AR, UFULLFORT_DAGER } from "@/lib/sak/lagringstid";

export const metadata: Metadata = { title: "Personvern – Tvistr" };

// The privacy statement. Every line must hold in the code: what the check sends (src/app/sak/rens.ts),
// what a case stores (sak in src/db/schema.ts), what the model reads (src/lib/vedtaksvalg/kjoper.ts),
// the measuring (src/lib/maling.ts) and the deletion (src/lib/sak/sletting.ts).
export default function Personvern() {
  const epost = <a href={`mailto:${FIRMA.epost}`}>{FIRMA.epost}</a>;
  return (
    <Juridisk tittel="Personvernerklæring" oppdatert="17. oktober 2026">
      <div className="jur-kort">
        <ul>
          <li>Den gratis saksvurderingen lagres bare i nettleseren din.</li>
          <li>{GRATIS ? "Åpner" : "Kjøper"} du brevet, lagrer vi saken hos oss i {LAGRES_AR} år, slik at du kan åpne den igjen med lenken din.</li>
          <li>Vi selger ikke opplysningene dine, og vi bruker ikke informasjonskapsler (cookies).</li>
        </ul>
      </div>

      <h2>Hvem som er ansvarlig</h2>
      <p>
        {FIRMA.navn} ({FIRMA.form}, org.nr. {FIRMA.orgnr}), {FIRMA.adresse}, er ansvarlig for behandlingen av personopplysninger i Tvistr. Spørsmål sender du til {epost}.
      </p>

      <h2>Den gratis saksvurderingen</h2>
      <p>Svarene dine lagres i nettleseren din, slik at du kan fortsette senere. Vi lagrer dem ikke. Du sletter dem med «Start på nytt» eller ved å slette nettleserdataene for nettstedet.</p>
      <p>For å finne lignende saker sender nettleseren deler av svarene til serveren vår: kjøpsdatoen, kilometerstanden, årsmodellen, feilene og når du oppdaget dem. De brukes bare til oppslaget og lagres ikke. Registreringsnummeret er ikke med.</p>
      <p>Trykker du «Hent bilen», sender vi registreringsnummeret til Statens vegvesen og henter merke, modell, årsmodell og datoen bilen sist ble registrert på en ny eier. Vi lagrer ikke oppslaget.</p>

      <h2>Når du {GRATIS ? "åpner" : "kjøper"} brevet</h2>
      <p>Da lagrer vi saken i databasen vår, og den lagres fortløpende mens du skriver. Saken inneholder svarene fra saksvurderingen og det du fyller inn i brevet:</p>
      <ul>
        <li>navnet, adressen, telefonnummeret og e-postadressen din</li>
        <li>opplysninger om forhandleren</li>
        <li>bilen, registreringsnummeret, datoene, prisen og kilometerstanden</li>
        <li>beskrivelsen av feilene, det verkstedet og selgeren har sagt, og kravet ditt</li>
        <li>navnene på vedleggene. Selve filene lastes ikke opp.</li>
      </ul>
      <p>Vi bruker opplysningene til å lage brevet og la deg komme tilbake til saken. Grunnlaget er avtalen med deg (personvernforordningen artikkel 6 nr. 1 bokstav b).</p>
      <p>Saken har en tilfeldig lenke, og lenken er tilgangen. Alle som har lenken, kan åpne saken, så ikke del den med andre.</p>
      <p>For å velge vedtaket brevet viser til, sender vi en del av saken til en språkmodell hos Anthropic: feilene og beskrivelsen din av dem, når de viste seg, kilometerstanden, bilens alder, kravet og om verkstedet eller selgeren har uttalt seg. Navn, adresse, kontaktopplysninger og registreringsnummer sendes ikke. Skriv derfor ikke personopplysninger i beskrivelsen av feilen.</p>
      {!GRATIS && <p>Betalingen skjer hos Vipps MobilePay, som behandler betalingsopplysningene som selvstendig ansvarlig etter sin egen personvernerklæring. Vi får beløpet, statusen og en referanse til betalingen.</p>}

      <h2>Måling av bruken</h2>
      <p>Vi teller hvor mange som kommer gjennom hvert steg, for eksempel at en saksvurdering ble startet, hvilket nivå vurderingen fikk og hvilke feilkategorier som ble valgt. Hver økt får en tilfeldig id som forsvinner når du lukker fanen. Vi lagrer ikke IP-adresse, navn, registreringsnummer eller datoer.</p>

      <h2>Tekniske logger</h2>
      <p>Vercel, som drifter nettstedet, registrerer tekniske opplysninger om hver forespørsel, som IP-adressen, for drift og sikkerhet. IP-adressen kan også brukes en kort stund til å begrense hvor mange forsøk som gjøres. Grunnlaget er vår berettigede interesse i et sikkert nettsted (artikkel 6 nr. 1 bokstav f).</p>

      <h2>Hvem som behandler opplysningene for oss</h2>
      <ul>
        <li>
          <b>Vercel Inc.</b> (USA) drifter nettstedet.
        </li>
        <li>
          <b>Neon</b> lagrer databasen, på servere i London.
        </li>
        <li>
          <b>Anthropic PBC</b> (USA) leverer språkmodellen som velger vedtaket. Etter Anthropics vilkår for bedriftskunder brukes opplysningene ikke til å trene modellene deres.
        </li>
      </ul>
      <p>De behandler opplysningene bare på våre vegne, etter databehandleravtaler. Når opplysninger overføres til USA, skjer det etter EU–USA-rammeverket for personvern (Data Privacy Framework) eller EUs standardavtaler. Storbritannia er godkjent av EU som et land med tilstrekkelig beskyttelse.</p>

      <h2>Hvor lenge vi lagrer opplysningene</h2>
      <ul>
        <li>Den gratis saksvurderingen ligger i nettleseren din til du starter på nytt eller sletter nettleserdataene.</li>
        <li>
          {GRATIS ? "En sak" : "En betalt sak"} lagres i {LAGRES_AR} år etter {GRATIS ? "at du åpnet brevet" : "betalingen"}, slik at du har brevet hvis saken går videre til mekling eller Forbrukerklageutvalget. Deretter slettes den automatisk.
        </li>
        {!GRATIS && (
          <>
            <li>Et kjøp som ikke blir betalt, slettes etter {UFULLFORT_DAGER} dager.</li>
            <li>Opplysningene om betalingen (beløp, dato og referanse) oppbevares i regnskapet i fem år, slik bokføringsloven krever.</li>
          </>
        )}
      </ul>
      <p>Du kan be om at saken slettes tidligere.</p>

      <h2>Rettighetene dine</h2>
      <p>Du har rett til innsyn i opplysningene vi har om deg, og til å få dem rettet eller slettet. Du kan også be om at behandlingen begrenses, protestere mot den, og få opplysningene utlevert i et vanlig format.</p>
      <p>Send en e-post til {epost}, og ta med lenken til saken, slik at vi finner den. Vi svarer innen en måned. Mener du at vi behandler opplysningene i strid med reglene, kan du klage til Datatilsynet.</p>

      <h2>Endringer</h2>
      <p>Endrer vi erklæringen, oppdaterer vi datoen øverst.</p>
    </Juridisk>
  );
}
