// Cookie names, apart from okt.ts so a client component can import them without next/headers.
export const OKT = "tvistr_okt";
export const INNE = "tvistr_inne";
// Browser only: the readable hint that this browser logged in. Never proof of a session.
export const inneHint = () => document.cookie.split("; ").includes(`${INNE}=1`);
