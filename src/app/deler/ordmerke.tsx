// The Tvistr wordmark: lowercase Geist Bold with a dotless ı, tight letter-spacing.
export function Ordmerke({ size = 26, color = "var(--ink)" }: { size?: number; color?: string }) {
  return (
    <span role="img" aria-label="Tvistr" style={{ display: "inline-block", fontSize: size, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.045em", color, whiteSpace: "nowrap" }}>
      <span aria-hidden="true">tvıstr</span>
    </span>
  );
}
