import type { Metadata } from "next";
import { Juridisk } from "@/app/deler/juridisk";
import { FIRMA } from "@/lib/firma";
import { LAGRES_AR, UFULLFORT_DAGER } from "@/lib/sak/lagringstid";

export const metadata: Metadata = { title: "Personvern – Tvistr" };

// The privacy statement. Every line must hold in the code: what the questions send (forhandsvis in
// src/app/sak/brevet-actions.ts), what a case stores (sak in src/db/schema.ts), what the model reads
// (src/lib/vedtaksvalg/kjoper.ts), the measuring (src/lib/maling.ts) and the deletion (src/lib/sak/sletting.ts).
export default function Personvern() {
  const epost = <a href={`mailto:${FIRMA.epost}`}>{FIRMA.epost}</a>;
  return (
    <Juridisk tittel="Personvernerklæring" oppdatert="21. oktober 2026">
      <div className="jur-kort">
        <ul>
          <li>Den gratis saksvurderingen lagres bare i nettleseren din.</li>
          <li>Kjøper du brevet, lagrer vi saken hos oss i {LAGRES_AR} år, slik at du kan åpne den igjen når du logger inn med Vipps.</li>
          <li>Vi selger ikke opplysningene dine, og vi bruker bare informasjonskapsler som trengs for innloggingen, og ingen for sporing.</li>
        </ul>
      </div>

      <h2>Hvem som er ansvarlig</h2>
      <p>
        {FIRMA.navn} ({FIRMA.form}, org.nr. {FIRMA.orgnr}), {FIRMA.adresse}, er ansvarlig for behandlingen av personopplysninger i Tvistr. Spørsmål sender du til {epost}.
      </p>

      <h2>Den gratis saksvurderingen</h2>
      <p>Svarene dine lagres i nettleseren din, slik at du kan fortsette senere. Vi lagrer dem ikke. Du sletter dem ved å slette nettleserdataene for nettstedet.</p>
      <p>For å vise brevet og finne lignende saker sender nettleseren svarene dine til serveren vår mens du fyller ut, også registreringsnummeret og det du skriver om feilen. De brukes bare til å lage forhåndsvisningen og lagres ikke.</p>
      <p>Trykker du «Hent bilen», sender vi registreringsnummeret til Statens vegvesen og henter merke, modell, årsmodell og datoen bilen sist ble registrert på en ny eier. Vi lagrer ikke oppslaget.</p>

      <h2>Når du kjøper brevet</h2>
      <p>Da lagrer vi saken i databasen vår, og den lagres fortløpende mens du skriver. Saken inneholder svarene fra saksvurderingen og det du fyller inn i brevet:</p>
      <ul>
        <li>navnet, adressen, telefonnummeret og e-postadressen din</li>
        <li>opplysninger om forhandleren</li>
        <li>bilen, registreringsnummeret, datoene, prisen og kilometerstanden</li>
        <li>beskrivelsen av feilene, det verkstedet og selgeren har sagt, og kravet ditt</li>
        <li>hvilke dokumenter du legger ved. Selve dokumentene lastes ikke opp.</li>
      </ul>
      <p>Vi bruker opplysningene til å lage brevet og la deg komme tilbake til saken. Grunnlaget er avtalen med deg (personvernforordningen artikkel 6 nr. 1 bokstav b).</p>
      <p>For å velge vedtaket brevet viser til, sender vi en del av saken til en språkmodell hos Anthropic: feilene og beskrivelsen din av dem, når de viste seg, kilometerstanden, bilens alder, kravet og om verkstedet eller selgeren har uttalt seg. Navn, adresse, kontaktopplysninger og registreringsnummer sendes ikke. Skriv derfor ikke personopplysninger i beskrivelsen av feilen.</p>
      <p>Betalingen skjer hos Vipps MobilePay, som behandler betalingsopplysningene som selvstendig ansvarlig etter sin egen personvernerklæring. Vi får beløpet, statusen og en referanse til betalingen. Vipps bekrefter også hvem du er når du logger inn.</p>
      <p>Når du betaler, ber vi Vipps om navnet, e-postadressen, telefonnummeret og adressen din. Du godkjenner delingen i Vipps-appen før du betaler. Vi fyller dem inn i brevet, der du kan endre dem, og sender kvitteringen og lenken til saken til e-postadressen. Vi lagrer dem bare i saken.</p>
      <p>Vipps oppgir også en id for Vipps-kontoen din. Vi lagrer den på saken som eier, og bare den som logger inn med den kontoen, kan åpne saken.</p>

      <h2>Innlogging</h2>
      <p>Du logger inn med Vipps for å åpne en betalt sak og Min side. Vipps MobilePay bekrefter da hvem du er, som selvstendig ansvarlig etter sin egen personvernerklæring. Vi får bare en id for Vipps-kontoen din, ikke navn, telefonnummer eller andre opplysninger. Id-en lagres på saken du betalte for, og i en økt så lenge du er innlogget.</p>
      <p>Innloggingen bruker tre informasjonskapsler. Den første holder deg innlogget i 90 dager. Den inneholder en tilfeldig kode, og i databasen lagrer vi bare en envegs-hash av koden. Den andre er en liten merkelapp, også i 90 dager, som bare sier at du har logget inn før, slik at siden kan foreslå innlogging. Den tredje settes bare mens du logger inn, varer i 10 minutter og slettes når Vipps har sendt deg tilbake. Alle er nødvendige for innloggingen, og ingen brukes til sporing. Når du logger ut, slettes økten fra databasen og kapslene fra nettleseren din. Økter som har gått ut, og påbegynte innlogginger som aldri ble fullført, slettes automatisk.</p>

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
          <b>Resend Inc.</b> (USA) sender kvitteringen på e-post, fra servere i EU (Irland).
        </li>
        <li>
          <b>Anthropic PBC</b> (USA) leverer språkmodellen som velger vedtaket. Etter Anthropics vilkår for bedriftskunder brukes opplysningene ikke til å trene modellene deres.
        </li>
      </ul>
      <p>De behandler opplysningene bare på våre vegne, etter databehandleravtaler. Når opplysninger overføres til USA, skjer det etter EU–USA-rammeverket for personvern (Data Privacy Framework) eller EUs standardavtaler. Storbritannia er godkjent av EU som et land med tilstrekkelig beskyttelse.</p>

      <h2>Hvor lenge vi lagrer opplysningene</h2>
      <ul>
        <li>Den gratis saksvurderingen ligger i nettleseren din til du starter en ny sak eller sletter nettleserdataene.</li>
        <li>
          En betalt sak lagres i {LAGRES_AR} år etter betalingen, slik at du har brevet hvis saken går videre til mekling eller Forbrukerklageutvalget. Deretter slettes den automatisk.
        </li>
        <li>Et kjøp som ikke blir betalt, slettes etter {UFULLFORT_DAGER} dager.</li>
        <li>Opplysningene om betalingen (beløp, dato og referanse) oppbevares i regnskapet i fem år, slik bokføringsloven krever.</li>
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
