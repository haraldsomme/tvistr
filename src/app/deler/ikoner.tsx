// The artifact's inline icons (stroke SVGs). Decorative: hidden from screen readers.
import type { ReactNode } from "react";

const Svg = ({ s = 16, w = 2, children, ...p }: { s?: number; w?: number; children: ReactNode } & React.SVGProps<SVGSVGElement>) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const Hake = ({ s = 12, w = 3 }: { s?: number; w?: number }) => (
  <Svg s={s} w={w}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);
export const Varsel = () => (
  <Svg s={14} w={2.6}>
    <path d="M12 7v6M12 17h.01" />
  </Svg>
);
export const Kryss = ({ s = 13, w = 2.8 }: { s?: number; w?: number }) => (
  <Svg s={s} w={w}>
    <path d="M7 7l10 10M17 7L7 17" />
  </Svg>
);
export const Info = ({ s = 14 }: { s?: number }) => (
  <Svg s={s} w={2.4}>
    <path d="M12 8h.01M11 12h1v5h1" />
  </Svg>
);
export const InfoSirkel = () => (
  <Svg s={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M11 12h1v5h1" />
  </Svg>
);
export const Pil = () => (
  <Svg>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const Tilbake = () => (
  <Svg>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const Frem = () => (
  <Svg>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);
export const Dokument = ({ s = 18 }: { s?: number }) => (
  <Svg s={s} w={1.9}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </Svg>
);
export const Lukk = ({ s = 16 }: { s?: number }) => (
  <Svg s={s} w={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const Pluss = () => (
  <Svg s={13} w={2.4}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const Fil = () => (
  <Svg s={15} w={1.8} style={{ color: "var(--muted)", flex: "none" }}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </Svg>
);
export const Opplast = () => (
  <Svg s={22} w={1.7} style={{ color: "var(--muted)" }}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Svg>
);
export const Kopier = () => (
  <Svg s={15}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
);
export const Trekant = () => (
  <Svg s={18}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </Svg>
);
export const Fold = () => (
  <Svg className="fold-c">
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

// The claim tiles (artifact ICO).
export const KRAVIKON: Record<string, ReactNode> = {
  retting: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  omlevering: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  prisavslag: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a1.9 1.9 0 0 1-2.8 0L3 13V3h10l7.6 7.6a1.9 1.9 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  heving: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
};
export const Kravikon = ({ id }: { id: string }) => (
  <Svg s={18} w={1.8}>
    {KRAVIKON[id]}
  </Svg>
);

// The icon for a verdict factor.
export const Faktorikon = ({ s }: { s: "good" | "warn" | "bad" | "info" }) => (s === "good" ? <Hake s={13} /> : s === "warn" ? <Varsel /> : s === "bad" ? <Kryss /> : <Info />);

// The blue band of a Norwegian plate.
export const Skiltband = () => (
  <div className="pband" aria-hidden="true">
    <svg width="16" height="12" viewBox="0 0 22 16">
      <rect width="22" height="16" fill="#BA0C2F" />
      <path d="M0 8h22M8 0v16" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M0 8h22M8 0v16" stroke="#00205B" strokeWidth="2" />
    </svg>
    <b>N</b>
  </div>
);
