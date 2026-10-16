// Payment. This is a stub: Vipps is not connected (a task of its own). Until it is, an order id from
// the dev unlock (lasOpp) stands for a confirmed payment, in development only.

// Development only: the pay button unlocks the letter without paying.
export const HELT_BREV_UTEN_BETALING = () => process.env.NODE_ENV !== "production" && process.env.TVISTR_HELT_BREV_UTEN_BETALING === "1";

// Whether the order is paid. The real version looks the order up with Vipps.
export const betalt = (ordreId: unknown): boolean => HELT_BREV_UTEN_BETALING() && typeof ordreId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(ordreId);
