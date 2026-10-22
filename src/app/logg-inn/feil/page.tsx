import type { Metadata } from "next";
import { Melding, Side } from "@/app/deler/juridisk";

export const metadata: Metadata = { title: "Innlogging – Tvistr", robots: { index: false, follow: false } };

// Every rejected login ends here. The retry is a plain <a>: /logg-inn is a route handler that sends
// the user on to Vipps, and a prefetching <Link> would start logins nobody asked for.
export default function Page() {
  return (
    <Side>
      <Melding tittel="Innloggingen ble ikke fullført">
        <a href="/logg-inn" className="btn pri" style={{ textDecoration: "none" }}>
          Prøv igjen
        </a>
      </Melding>
    </Side>
  );
}
