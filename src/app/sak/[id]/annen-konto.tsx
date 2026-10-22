import { Melding, Side } from "@/app/deler/juridisk";
import { LoggUt } from "@/app/deler/logg-ut";

// Shown to a logged-in user who does not own the case. Says nothing about the case itself.
export function AnnenKonto() {
  return (
    <Side>
      <Melding tittel="Denne saken tilhører en annen Vipps-konto. Logg inn med Vipps-kontoen som betalte.">
        <LoggUt />
      </Melding>
    </Side>
  );
}
