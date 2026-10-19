"use client";

import { loggUtHandling } from "@/app/min-side/actions";

// Logs out, clears the check kept in this browser, and goes to the front page.
export function LoggUt() {
  async function gaa() {
    await loggUtHandling();
    try {
      localStorage.removeItem("tvistr-sak");
    } catch {}
    // A full load on purpose: nothing from the logged-in session may stay in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }
  return (
    <button type="button" className="btn" onClick={gaa}>
      Logg ut
    </button>
  );
}
