import { describe, expect, it } from "vitest";
import { dur, parseD, relText } from "./dato";
import { regler } from "./lov";
import { eksempel, syncAreas } from "./skjema";
import { evaluate, skriverResultat, wsFactors } from "./vurdering";

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

describe("rettinger etter gjennomgangen", () => {
  it("#1 skriveren bruker kjøpsdatoen for lovversjonen", () => {
    const s = { ...eksempel(idag), c_purchase: "2023-12-20", c_delivery: "2024-01-05", c_asis: true };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2024-10-01" } };
    const r = skriverResultat(syncAreas(s), idag);
    expect(r.factors.some((f) => f.t.startsWith("Mer enn seks måneder"))).toBe(true);
    expect(r.factors.find((f) => f.t === "Solgt «som den er»")?.law).toBe("forbrkjl. § 17 første ledd bokstav a");
  });
  it("#2 «som den er» fra 2024 er ikke et avtalt unntak, uten «vesentlig»", () => {
    const f = evaluate({ ...base, asis: "ja", delivery: "2024-06-01", found: "2024-07-01" }, idag).factors.find((x) => x.t === "Solgt «som den er»")!;
    expect(f.s).toBe("info");
    expect(f.d).not.toContain("vesentlig");
    expect(f.d).toContain("spesielt opplyst");
  });
  it("#3 seks måneder telles i kalendermåneder", () => {
    expect(evaluate({ ...base, delivery: "2023-01-31", found: "2023-08-01" }, idag).factors.some((f) => f.t.startsWith("Mer enn seks måneder"))).toBe(true);
    expect(evaluate({ ...base, delivery: "2023-01-31", found: "2023-07-31" }, idag).factors.some((f) => f.t === "Feilen viste seg innen seks måneder")).toBe(true);
  });
});

describe("tidslinjen i vurderingen", () => {
  it("sa fra før feilen ble oppdaget", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-09-01", notified: "ja", notifiedDate: "2026-08-01" }, idag).factors.some((f) => f.t === "Sjekk datoene")).toBe(true));
  it("dato frem i tid", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-12-01" }, idag).factors.some((f) => f.t === "Sjekk datoene")).toBe(true));
  it("én av flere feil utenfor formodningen", () => expect(evaluate({ ...base, delivery: "2023-03-01", found: "2023-05-01", sist: "2024-01-15" }, idag).factors.some((f) => f.t === "Én av feilene viste seg senere")).toBe(true));
});

describe("brukertesten", () => {
  it("over to år: «Mer enn to år»", () => expect(evaluate({ ...base, delivery: "2022-09-01", found: "2025-10-01" }, idag).factors.some((f) => f.t === "Mer enn to år etter overtakelsen")).toBe(true));
  it("fristen ute: ikke samtidig «Du er i tide»", () => {
    const r = evaluate({ ...base, delivery: "2021-02-01", found: "2026-09-01" }, idag);
    expect(r.factors.some((f) => f.t === "Fristen er ute")).toBe(true);
    expect(r.factors.some((f) => f.t === "Du er i tide")).toBe(false);
  });
  it("fristen ute når reklamasjonen kommer etter fem år, selv om feilen viste seg før", () =>
    expect(evaluate({ ...base, delivery: "2021-09-01", found: "2026-08-01" }, idag).factors.some((f) => f.t === "Fristen er ute")).toBe(true));
  it("feil i det selgeren opplyste: ingen formodning", () => {
    const r = evaluate({ ...base, delivery: "2026-03-01", found: "2026-06-01", opplysning: true }, idag);
    expect(r.factors.some((f) => f.t.startsWith("Feilen viste seg innen"))).toBe(false);
    expect(r.factors.some((f) => f.t === "Bilen var ikke som selgeren opplyste")).toBe(true);
  });
});

describe("kanttilfeller", () => {
  it("uten datoer: foreløpig, ikke «Mulig sak»", () => {
    const r = evaluate({ seller: "forhandler" }, idag);
    expect(r.tier).toBe("ukjent");
    expect(r.badge).toBe("Foreløpig");
  });
  it("dato frem i tid: ingen konklusjoner om frister", () => {
    const r = evaluate({ ...base, delivery: "2026-06-01", found: "2027-01-01" }, idag);
    expect(r.factors.some((f) => f.t === "Sjekk datoene")).toBe(true);
    expect(r.factors.some((f) => /innen to år|Du er i tide/.test(f.t))).toBe(false);
  });
});
