// Development only: the pay button unlocks the letter without Vipps (kjop in src/app/sak/[id]/actions.ts),
// so the flow can be tested without approving a payment in the app. Never in production.
export const HELT_BREV_UTEN_BETALING = () => process.env.NODE_ENV !== "production" && process.env.TVISTR_HELT_BREV_UTEN_BETALING === "1";
// The owner of a case bought in development: there is no Vipps account, so the return page logs in as this.
export const UTVIKLINGSEIER = "utvikling";
