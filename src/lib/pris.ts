// The price of the letter, in kroner. Shown on the landing page, in the assessment and at payment.
export const PRIS = 249;

// A trial period with the letter free. Every text about price, payment and the right of withdrawal
// stays behind this switch. Off: the letter is paid with Vipps (src/lib/vipps/).
export const GRATIS = false;

// What a letter for another car or fault takes.
export const NYTT_KJOP = GRATIS ? "en ny sak" : "et nytt kjøp";
