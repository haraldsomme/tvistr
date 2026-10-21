"use client";

import { loggUtHandling } from "@/app/min-side/actions";

// Logs out, clears the purchase kept in this browser, and goes to the front page.
export async function loggUtOgForlat() {
  await loggUtHandling();
  try {
    localStorage.removeItem("tvistr-sak");
  } catch {}
  // A full load on purpose: nothing from the logged-in session may stay in memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}

export function LoggUt() {
  return (
    <button type="button" className="btn" onClick={loggUtOgForlat}>
      Logg ut
    </button>
  );
}
