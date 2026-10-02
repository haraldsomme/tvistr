// Deletes letter cases that have expired (30 days after they were last changed). Expired cases are
// also deleted when someone opens them; this takes the ones nobody comes back to.
import { ryddUtlopte } from "../src/lib/brev/sak";

ryddUtlopte()
  .then((n) => console.log(`Slettet ${n} utløpte saker.`))
  .catch(() => {
    console.error("Rydding feilet.");
    process.exit(1);
  });
