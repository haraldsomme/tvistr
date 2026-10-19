import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { standard } from "@/lib/app/skjema";

const krav = vi.hoisted(() => ({ rader: [] as unknown[] }));
const satt = vi.fn<(v: unknown) => void>();
vi.mock("@/db", () => ({
  db: {
    // The claim on the order (update … returning), and the release when the sending fails.
    update: () => ({ set: (v: unknown) => (satt(v), { where: () => Object.assign(Promise.resolve(), { returning: async () => krav.rader }) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ skjema: { ...standard("2026-10-19"), c_make: "Peugeot", c_model: "308", c_reg: "AB 12345" } }] }) }) }),
  },
}));

const { byggKvittering, sendKvittering } = await import("./kvittering");

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  krav.rader = [{ sakId: "sak222222222", belopOre: 24900, betalt: new Date("2026-10-19T12:00:00Z") }];
  process.env.RESEND_API_KEY = "re_test";
  process.env.TVISTR_URL = "https://tvistr.no";
});
afterEach(() => vi.unstubAllGlobals());

describe("byggKvittering", () => {
  const k = byggKvittering({ ref: "abcdefghijkm", sakId: "sak222222222", belopOre: 24900, betalt: new Date("2026-10-19T12:00:00Z"), bil: "Peugeot <308>", reg: "AB 12345" });

  it("har lenken til saken, beløpet og ordrenummeret, i HTML og tekst", () => {
    for (const t of [k.html, k.tekst]) {
      expect(t).toContain("https://tvistr.no/sak/sak222222222");
      expect(t).toContain("kr 249");
      expect(t).toContain("abcdefghijkm");
      expect(t).toContain("19. oktober 2026");
      expect(t).toContain("ikke registrert i merverdiavgiftsregisteret");
    }
  });

  it("sier at saken åpnes med Vipps-kontoen, og lenker til Min side", () => {
    for (const t of [k.html, k.tekst]) {
      expect(t).toContain("Vipps-kontoen du betalte med");
      expect(t).toContain("https://tvistr.no/min-side");
      expect(t).not.toContain("Lenken er tilgangen");
    }
  });

  it("escaper det kjøperen har skrevet", () => {
    expect(k.html).not.toContain("<308>");
    expect(k.html).toContain("&#60;308&#62;");
  });
});

describe("sendKvittering", () => {
  it("sender én gang til e-posten, med lenken", async () => {
    expect(await sendKvittering("abcdefghijkm", "kari@eksempel.no")).toBe("sendt");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("kvittering-abcdefghijkm");
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ to: ["kari@eksempel.no"], reply_to: "hei@tvistr.no" });
    expect(body.text).toContain("https://tvistr.no/sak/sak222222222");
    expect(body.text).toContain("Peugeot 308 (AB 12345)");
  });

  it("sender til EPOST_TEST_TIL mot Vipps' testmiljø, men aldri mot produksjon", async () => {
    process.env.EPOST_TEST_TIL = "utvikler@eksempel.no";
    await sendKvittering("abcdefghijkm", "test.user@example.com");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).to).toEqual(["utvikler@eksempel.no"]);
    process.env.VIPPS_BASE_URL = "https://api.vipps.no";
    await sendKvittering("abcdefghijkm", "kari@eksempel.no");
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string).to).toEqual(["kari@eksempel.no"]);
    delete process.env.EPOST_TEST_TIL;
    delete process.env.VIPPS_BASE_URL;
  });

  it("sender ikke når kvitteringen allerede er sendt", async () => {
    krav.rader = [];
    expect(await sendKvittering("abcdefghijkm", "kari@eksempel.no")).toBe("hoppet");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sender ingenting uten adresse eller nøkkel", async () => {
    expect(await sendKvittering("abcdefghijkm", undefined)).toBe("hoppet");
    delete process.env.RESEND_API_KEY;
    expect(await sendKvittering("abcdefghijkm", "kari@eksempel.no")).toBe("hoppet");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(satt).not.toHaveBeenCalled();
  });

  it("slipper kravet når Resend svarer med feil, så nattjobben kan prøve igjen", async () => {
    fetchMock.mockResolvedValue(new Response("nei", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendKvittering("abcdefghijkm", "kari@eksempel.no")).toBe("feilet");
    expect(satt).toHaveBeenLastCalledWith({ kvitteringSendt: null });
  });
});
