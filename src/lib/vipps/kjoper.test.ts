import { describe, expect, it } from "vitest";
import { standard } from "@/lib/app/skjema";
import { fyllKjoper, maskerEpost } from "./kjoper";

const tom = standard("2026-10-19");
const fraVipps = { email: "kari@eksempel.no", firstName: "Kari", lastName: "Nordmann", mobileNumber: "4791234567", addresses: [{ addressLine1: "Storgata 12", postCode: "0155", city: "Oslo", country: "NO" }] };

describe("fyllKjoper", () => {
  it("fyller tomme felt fra Vipps", () => {
    expect(fyllKjoper(tom, fraVipps)).toMatchObject({ b_name: "Kari Nordmann", b_email: "kari@eksempel.no", b_phone: "912 34 567", b_addr: "Storgata 12", b_zip: "0155", b_city: "Oslo" });
  });

  it("beholder det skjemaet har fra forrige sak", () => {
    const s = fyllKjoper({ ...tom, b_name: "Ola", b_email: "ola@eksempel.no", b_city: "Bergen" }, fraVipps);
    expect(s).toMatchObject({ b_name: "Ola", b_email: "ola@eksempel.no", b_phone: "912 34 567", b_addr: "", b_zip: "", b_city: "Bergen" });
  });

  it("tåler manglende felt og utenlandske nummer", () => {
    expect(fyllKjoper(tom, { email: "a@b.no", mobileNumber: "4512345678" })).toMatchObject({ b_email: "a@b.no", b_phone: "", b_addr: "" });
    expect(fyllKjoper(tom, undefined)).toBe(tom);
  });
});

describe("maskerEpost", () => {
  it("viser bare første tegn og domenet", () => {
    expect(maskerEpost("kari.nordmann@gmail.com")).toBe("k***@gmail.com");
  });
});
