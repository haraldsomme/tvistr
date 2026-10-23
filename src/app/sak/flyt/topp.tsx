// The new flow's header (mockup «Sjekk saken»): the word mark to the front page, where the answers are
// kept («Lagret i nettleseren», «Lagret på kontoen din», «Lagrer …», «Ikke lagret, prøver igjen») and
// the account.
import Link from "next/link";
import { Kontomeny } from "@/app/deler/kontomeny";
import { Ordmerke } from "@/app/deler/ordmerke";

// The dot's colour follows the wording: saving, failed, or kept.
const tilstand = (lagring: string) => (lagring.startsWith("Ikke lagret,") ? "feil" : lagring.startsWith("Lagrer") || lagring === "Ikke lagret ennå" ? "lagrer" : "ok");

export function Topp({ lagring, aktivSak }: { lagring: string; aktivSak?: string }) {
  return (
    <header className="fl-topp">
      <Link href="/" aria-label="Tvistr, til forsiden" className="fl-merke">
        <Ordmerke size={26} color="var(--fl-ink)" />
      </Link>
      <span className="fl-fyll" />
      {/* Below 960px the words show only while saving or after a failure (globals.css). */}
      <span className="fl-lagring" data-tilstand={tilstand(lagring)} role="status" title={lagring}>
        <span aria-hidden="true" />
        <span className="fl-lagring-t">{lagring}</span>
      </span>
      <Kontomeny aktivSak={aktivSak} />
    </header>
  );
}
