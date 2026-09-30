import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "./robots";

const txt = `
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /*.php$
`;

describe("robots", () => {
  const rules = parseRobots(txt, "TvistrBot");

  it("uses the * group when no specific group matches", () => {
    expect(isAllowed(rules, "/forbrukerklageutvalget/")).toBe(true);
    expect(isAllowed(rules, "/wp-admin/options.php")).toBe(false);
  });

  it("lets the longest matching rule win", () => {
    expect(isAllowed(rules, "/wp-admin/admin-ajax.php")).toBe(true);
  });

  it("supports wildcards and end anchors", () => {
    expect(isAllowed(rules, "/foo/bar.php")).toBe(false);
    expect(isAllowed(rules, "/foo/bar.php?x=1")).toBe(true);
  });

  it("allows everything when robots.txt is empty", () => {
    expect(isAllowed(parseRobots("", "TvistrBot"), "/x")).toBe(true);
  });
});
