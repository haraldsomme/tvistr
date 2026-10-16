import Link from "next/link";
import { Dokument } from "./ikoner";

// The brand mark and name, linking to the landing page.
export function Merke({ undertekst }: { undertekst: string }) {
  return (
    <Link href="/" className="brand brand-btn" aria-label="Tvistr, til forsiden" style={{ textDecoration: "none" }}>
      <div className="mark" aria-hidden="true">
        <Dokument />
      </div>
      <div>
        <b>Tvistr</b>
        <small>{undertekst}</small>
      </div>
    </Link>
  );
}
