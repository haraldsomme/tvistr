import type { Metadata } from "next";
import { Juridisk } from "@/app/deler/juridisk";

export const metadata: Metadata = { title: "Hvis forhandleren avviser – Tvistr" };

// What the buyer can do after the letter, linked from the Brevet tab. Every claim comes from Forbrukertilsynet's
// pages send-sak-til-mekling (updated 3.9.2026) and behandling-forbrukerklageutvalget (updated 12.2.2026).
// The fees follow the court fee (rettsgebyret) and change every year.
export default function HvisAvvist() {
  return (
    <Juridisk tittel="Hvis forhandleren avviser" oppdatert="18. oktober 2026">
      <div className="jur-kort">
        <ul>
          <li>Klag skriftlig til forhandleren først, og ta vare på svaret.</li>
          <li>Avviser forhandleren kravet, kan du sende saken til mekling hos Forbrukertilsynet.</li>
          <li>Fører ikke meklingen frem, kan du sende saken til Forbrukerklageutvalget.</li>
        </ul>
      </div>

      <h2>Før du går videre</h2>
      <p>Ta vare på brevet du sendte, svaret fra forhandleren og annen dokumentasjon, for eksempel e-poster, verkstedrapporter og kvitteringer. Forbrukertilsynet krever at du har klaget til forhandleren før du sender saken til mekling.</p>
      <p>
        Forbrukerrådet gir gratis råd om saken din: <a href="https://www.forbrukerradet.no" target="_blank" rel="noopener noreferrer">forbrukerradet.no</a>.
      </p>

      <h2>Mekling hos Forbrukertilsynet</h2>
      <p>Forbrukertilsynet mekler mellom deg og forhandleren når du har kjøpt bilen til privat bruk. Du sender saken på Min side hos Forbrukertilsynet, og meklingen skjer på telefon, e-post og Min side. Du trenger ikke møte opp.</p>
      <ul>
        <li>Gebyret er 0,2 rettsgebyr, 269 kr i 2026. Det betales ikke tilbake hvis du trekker saken eller tilsynet ikke kan behandle den.</li>
        <li>Ventetiden er for tiden 5–6 måneder.</li>
        <li>Du trenger forhandlerens fulle navn og adresse. Dem finner du i Brønnøysundregistrene.</li>
      </ul>
      <p>Blir dere enige, skrives det en bindende avtale.</p>

      <h2>Forbrukerklageutvalget</h2>
      <p>Fører ikke meklingen frem, kan du sende saken til Forbrukerklageutvalget innen én måned etter at meklingssaken ble avsluttet. Det koster ett rettsgebyr, som du betaler når du sender saken.</p>
      <p>Vedtaket er bindende for begge parter med mindre en av dere tar saken til tingretten innen én måned. Det er de samme vedtakene Tvistr bygger vurderingen og brevet på.</p>

      <h2>Forhandleren er konkurs</h2>
      <p>Da kan Forbrukertilsynet ikke behandle saken, heller ikke hvis konkursen kommer mens saken pågår. Meld kravet ditt til bostyreren.</p>

      <h2>Forhandleren er enig, men betaler ikke</h2>
      <p>Kontakt namsmannen.</p>

      <h2>Kilder</h2>
      <ul>
        <li>
          Forbrukertilsynet: <a href="https://www.forbrukertilsynet.no/send-sak-til-mekling" target="_blank" rel="noopener noreferrer">Send sak til mekling</a>
        </li>
        <li>
          Forbrukertilsynet: <a href="https://www.forbrukertilsynet.no/behandling-forbrukerklageutvalget" target="_blank" rel="noopener noreferrer">Behandling i Forbrukerklageutvalget</a>
        </li>
      </ul>
    </Juridisk>
  );
}
