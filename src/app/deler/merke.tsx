import Link from "next/link";
import { Ordmerke } from "./ordmerke";

// The brand mark and name, linking to the landing page.
export function Merke() {
  return (
    <Link href="/" className="brand brand-btn" aria-label="Tvistr, til forsiden" style={{ textDecoration: "none" }}>
      <Ordmerke size={30} />
    </Link>
  );
}
