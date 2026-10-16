import { describe, expect, it } from "vitest";
import { dur, parseD, relText } from "./dato";
import { regler } from "./lov";
import { evaluate, wsFactors } from "./vurdering";

const idag = "2026-10-16";
const base = { seller: "forhandler", buyer: "privat", asis: "nei", known: "nei", cause: "nei", notified: "nei" } as const;
const har = (r: ReturnType<typeof evaluate>, t: string) => r.factors.some((f) => f.t === t);

describe("evaluate", () => {
  it("sterk etter 2024", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01" }, idag).tier).toBe("sterk"));
  it("innen to år etter 2024", () => expect(har(evaluate({ ...base, delivery: "2025-01-10", found: "2026-06-01" }, idag), "Feilen viste seg innen to år")).toBe(true));
  it("seks måneder før 2024", () => {
    const r = evaluate({ ...base, delivery: "2023-12-31", found: "2024-09-01" }, idag);
    expect(r.factors.some((f) => f.t.startsWith("Mer enn seks måneder"))).toBe(true);
    expect(r.tier).toBe("mulig");
  });
  it("innen seks måneder før 2024", () => expect(har(evaluate({ ...base, delivery: "2023-06-01", found: "2023-09-01" }, idag), "Feilen viste seg innen seks måneder")).toBe(true));
  it("grensen 1.1.2024", () => expect(har(evaluate({ ...base, delivery: "2024-01-01", found: "2024-09-01" }, idag), "Feilen viste seg innen to år")).toBe(true));
  it("svak ved uhell", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01", cause: "uhell" }, idag).tier).toBe("svak"));
  it("fristen er ute", () => expect(har(evaluate({ ...base, delivery: "2020-01-01", found: "2026-01-01" }, idag), "Fristen er ute")).toBe(true));
  it.each(["privat", "leasing"] as const)("utenfor: selger %s", (s) => expect(evaluate({ seller: s }, idag).tier).toBe("utenfor"));
  it("utenfor: næring", () => expect(evaluate({ seller: "forhandler", buyer: "naering" }, idag).tier).toBe("utenfor"));
  it("feil før overtakelsen", () => expect(har(evaluate({ ...base, delivery: "2026-06-01", found: "2026-05-01" }, idag), "Feilen ble oppdaget før overtakelsen")).toBe(true));
  it("datoene mangler", () => expect(har(evaluate({ ...base, found: "2026-05-01" }, idag), "Datoene mangler")).toBe(true));
  it("som den er før 2024 bruker gamle § 17", () =>
    expect(evaluate({ ...base, asis: "ja", delivery: "2023-06-01", found: "2023-07-01" }, idag).factors.find((f) => f.t === "Solgt «som den er»")?.law).toBe("forbrkjl. § 17 første ledd bokstav a"));
  it("som den er fra 2024 bruker § 15 annet ledd", () =>
    expect(evaluate({ ...base, asis: "ja", delivery: "2024-06-01", found: "2024-07-01" }, idag).factors.find((f) => f.t === "Solgt «som den er»")?.law).toBe("forbrkjl. § 15 annet ledd"));
  it("sender innen to måneder gir sendBy", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01" }, idag).sendBy).toBe("2026-12-01"));
});

describe("wsFactors", () => {
  it("rapport som sier levering", () => expect(wsFactors({ ws: "rapport", ws_says: ["levering"] })[0].s).toBe("good"));
  it("selger opplyste om feilen", () => expect(wsFactors({ seller_said: "opplyste" }).some((f) => f.s === "bad")).toBe(true));
});

describe("dato og lov", () => {
  it("regler før og etter 2024", () => {
    expect(regler("2023-12-31").formodningMnd).toBe(6);
    expect(regler("2024-01-01").formodningMnd).toBe(24);
    expect(regler(null).versjon).toBe("etter_2024");
    expect(regler("2023-05-01").ref("forbehold")).toBe("forbrkjl. § 17 første ledd bokstav a");
  });
  it("dur og relText", () => {
    expect(dur(parseD("2026-01-01")!, parseD("2026-03-15")!)).toBe("2 måneder");
    expect(relText("2026-03-15", "2026-01-01")).toBe("2 måneder og 2 uker etter overtakelsen");
    expect(relText("2025-12-01", "2026-01-01")).toBe("Før overtakelsen");
  });
});
