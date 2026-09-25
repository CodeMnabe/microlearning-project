// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("authenticated navigation", () => {
  it("links Home and Settings to their canonical routes without gating them by isAdmin", () => {
    const navbar = read("../../app/components/Navbar/Navbar.jsx");
    expect(navbar).toContain('href="/dashboard"');
    expect(navbar).toContain('href="/settings"');
    expect(navbar).not.toContain('href="/admin"');
    expect(navbar).not.toContain('href="/options"');
  });

  it("keeps canonical and compatibility routes private", () => {
    const proxy = read("../../proxy.js");
    for (const route of ["dashboard", "settings", "admin", "options"]) {
      expect(proxy).toContain(`"${route}"`);
    }
  });

  it("redirects both compatibility pages to localized settings", () => {
    const admin = read("../../app/[locale]/(app)/admin/page.js");
    const options = read("../../app/[locale]/(app)/options/page.js");
    expect(admin).toContain('redirect({ href: "/settings", locale })');
    expect(options).toContain('redirect({ href: "/settings", locale })');
  });

  it("uses dashboard after login", () => {
    const actions = read("../../app/[locale]/(auth)/login/actions.js");
    const page = read("../../app/[locale]/(auth)/login/page.jsx");
    expect(actions).toContain('redirect("/dashboard")');
    expect(page).toContain("/${locale}/dashboard");
    expect(page).not.toContain("/${locale}/users");
  });
});
