import { beforeEach, describe, expect, it, vi } from "vitest";

const kallVerktoy = vi.fn();
class AvvistAvModellError extends Error {}
vi.mock("@/lib/ai/klient", () => ({ kallVerktoy: (...a: unknown[]) => kallVerktoy(...a), AvvistAvModellError }));

const { sprakvask } = await import("./sprakvask");

const EGEN = "motorlampa lyser hele tida og bilen drar ikke i bakker, verkstedet sier turboen er ødelagt";
const svar = (tekst: unknown) => kallVerktoy.mockResolvedValueOnce({ input: { tekst } });

beforeEach(() => kallVerktoy.mockReset());

describe("sprakvask", () => {
  it("sender bare beskrivelsen og feiltypene til modellen", async () => {
    svar("Motorlampen lyser hele tiden, og bilen mister trekkraft i bakker. Verkstedet har funnet at turboen er ødelagt.");
    await sprakvask(EGEN, ["motor"]);
    const kall = kallVerktoy.mock.calls[0][0] as { bruker: string; system: string };
    expect(kall.bruker).toContain(EGEN);
    expect(kall.bruker).toContain("«motor»");
    expect(kall.system).toContain("Ikke legg til noe som ikke står i teksten");
  });

  it("gir forslaget som ett avsnitt uten hakeparenteser", async () => {
    svar("Motorlampen lyser hele tiden.\nBilen mister [trekkraft] i bakker.");
    expect(await sprakvask(EGEN, ["motor"])).toEqual({ ok: true, tekst: "Motorlampen lyser hele tiden. Bilen mister (trekkraft) i bakker." });
  });

  it("forkaster forslag som er tomme, for korte, for lange eller ikke tekst", async () => {
    for (const t of ["", "Kort.", "x".repeat(1501), 42, undefined]) {
      svar(t);
      expect(await sprakvask(EGEN, ["motor"])).toEqual({ ok: false, grunn: "feilet" });
    }
  });

  it("skiller mellom at modellen avviser og at kallet feiler", async () => {
    kallVerktoy.mockRejectedValueOnce(new AvvistAvModellError("avvist"));
    expect(await sprakvask(EGEN, ["motor"])).toEqual({ ok: false, grunn: "avvist" });
    kallVerktoy.mockRejectedValueOnce(new Error("nett"));
    expect(await sprakvask(EGEN, ["motor"])).toEqual({ ok: false, grunn: "feilet" });
  });
});
