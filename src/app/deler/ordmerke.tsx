// The primary Tvistr wordmark: lowercase Overpass Black, with the dot of the i as a blue square.
export function Ordmerke({ size = 26, dot = "var(--accent)", color = "var(--ink)" }: { size?: number; dot?: string; color?: string }) {
  return (
    <span
      role="img"
      aria-label="Tvistr"
      style={{ display: "inline-flex", alignItems: "baseline", font: `900 ${size}px/1 var(--f-logo)`, letterSpacing: "-.045em", color, whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true">tv</span>
      <span aria-hidden="true" style={{ position: "relative", display: "inline-block", letterSpacing: 0, marginRight: "-.045em" }}>
        ı
        <span style={{ position: "absolute", left: "50%", bottom: ".82em", width: ".17em", height: ".17em", marginLeft: "-.085em", borderRadius: ".03em", background: dot }} />
      </span>
      <span aria-hidden="true">str</span>
    </span>
  );
}
