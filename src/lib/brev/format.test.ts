import { describe, expect, it } from "vitest";
import { tallord } from "./format";

describe("tallord", () => {
  it("en, to … tolv, ellers tallet", () => expect([1, 2, 3, 7, 12, 13].map(tallord)).toEqual(["en", "to", "tre", "sju", "tolv", "13"]));
});
