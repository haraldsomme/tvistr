import { expect, test } from "./fixtures";

// Starting point for the planner and generator agents: the form, open at step 1.
test.describe("Seed", () => {
  test("seed", async ({ page, skjema }) => {
    await page.goto("/vurdering");
    await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  });
});
