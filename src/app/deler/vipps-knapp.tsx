// Vipps MobilePay's own «Betal med Vipps» button (developer.vippsmobilepay.com/docs/knowledge-base/buttons),
// which must not be redrawn. For client components only (it takes a click handler). Until the script has loaded, or if it never does, the text inside shows.
import Script from "next/script";
import type { HTMLAttributes } from "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "vipps-mobilepay-button": HTMLAttributes<HTMLElement> & { brand?: string; language?: string; variant?: string; rounded?: string; verb?: string; stretched?: string };
    }
  }
}

export function VippsKnapp({ onClick, deaktivert = false, bred = false }: { onClick: () => void; deaktivert?: boolean; bred?: boolean }) {
  return (
    <>
      <Script src="https://cdn.vippsmobilepay.com/js/button/button.js" strategy="afterInteractive" />
      <vipps-mobilepay-button
        brand="vipps"
        language="no"
        variant="primary"
        rounded="true"
        verb="pay"
        stretched={bred ? "true" : "false"}
        aria-disabled={deaktivert}
        onClick={deaktivert ? undefined : onClick}
        style={{ display: "block", flexShrink: 0, opacity: deaktivert ? 0.45 : 1, pointerEvents: deaktivert ? "none" : undefined, transition: "opacity .2s" }}
      >
        Betal med Vipps
      </vipps-mobilepay-button>
    </>
  );
}
