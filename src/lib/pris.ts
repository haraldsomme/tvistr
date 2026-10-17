// The price of the letter, in kroner. Shown on the landing page, in the assessment and at payment.
export const PRIS = 249;

// Trial period: the letter is free until Vipps is approved. Every text about price, payment and the
// right of withdrawal stays behind this switch; set it to false when Vipps is connected.
export const GRATIS = true;

// What a letter for another car or fault takes.
export const NYTT_KJOP = GRATIS ? "en ny sak" : "et nytt kjøp";
