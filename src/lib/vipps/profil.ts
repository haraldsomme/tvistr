// Payment. This is a stub: Vipps is not connected (a task of its own). Until it is, the pay button
// saves the case as paid at once (kjop in src/app/sak/[id]/actions.ts), in development only.

// Development only: the pay button unlocks the letter without paying.
export const HELT_BREV_UTEN_BETALING = () => process.env.NODE_ENV !== "production" && process.env.TVISTR_HELT_BREV_UTEN_BETALING === "1";
