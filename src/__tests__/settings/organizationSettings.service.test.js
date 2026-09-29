import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getOrganizationSettings: vi.fn(),
  updateOrganizationSettings: vi.fn(),
}));

vi.mock("@/lib/repos/organizationSettings.repo", () => repo);

import { isValidHexColor } from "@/lib/helpers/theme.helpers";
import {
  normalizeOrganizationSettingsPatch,
  saveOrganizationSettings,
} from "@/lib/services/organizationSettings.service";

describe("organization settings validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts 3- and 6-digit hex colors and rejects invalid colors", () => {
    expect(isValidHexColor("#0af")).toBe(true);
    expect(isValidHexColor("#00AAff")).toBe(true);
    expect(isValidHexColor("#abcd")).toBe(false);
    expect(isValidHexColor("red")).toBe(false);
  });

  it("requires a complete theme", () => {
    expect(() =>
      normalizeOrganizationSettingsPatch({ theme: { primary: "#0af" } }),
    ).toThrow(/primary and secondary/i);

    expect(
      normalizeOrganizationSettingsPatch({
        theme: { primary: "#0af", secondary: "#123456", extra: "ignored" },
      }),
    ).toEqual({ theme: { primary: "#0af", secondary: "#123456" } });
  });

  it("rejects an empty or overlong name and trims a valid name", () => {
    expect(() => normalizeOrganizationSettingsPatch({ name: "   " })).toThrow(
      /required/i,
    );
    expect(() =>
      normalizeOrganizationSettingsPatch({ name: "x".repeat(151) }),
    ).toThrow(/150/);
    expect(normalizeOrganizationSettingsPatch({ name: "  Acme  " })).toEqual({
      name: "Acme",
    });
  });

  it("normalizes whitespace-only integration values to null", () => {
    expect(
      normalizeOrganizationSettingsPatch({
        teams_tenant_id: "   ",
        waba_id: " \t ",
        waba_namespace: " ns ",
      }),
    ).toEqual({
      teams_tenant_id: null,
      waba_id: null,
      waba_namespace: "ns",
    });
  });

  it("uses the shared country-code source", () => {
    expect(
      normalizeOrganizationSettingsPatch({
        default_phone_country_code: "+351",
      }),
    ).toEqual({ default_phone_country_code: "+351" });
    expect(() =>
      normalizeOrganizationSettingsPatch({
        default_phone_country_code: "+999",
      }),
    ).toThrow(/not supported/i);
  });

  it("removes every non-settings field from the generic patch", () => {
    const forbidden = {
      plan_id: 99,
      max_users_override: 999999,
      owner_user_id: "attacker",
      channel_id: "channel",
      id: 42,
      created_at: "tomorrow",
      logo_url: "https://attacker.invalid/logo.svg",
    };

    expect(
      normalizeOrganizationSettingsPatch({ name: " Safe ", ...forbidden }),
    ).toEqual({ name: "Safe" });
    expect(() => normalizeOrganizationSettingsPatch(forbidden)).toThrow(
      /No supported settings fields/i,
    );
  });

  it("maps a duplicate Teams tenant constraint to HTTP 409", async () => {
    repo.updateOrganizationSettings.mockRejectedValue({ code: "23505" });

    await expect(
      saveOrganizationSettings(7, { teams_tenant_id: "tenant-1" }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
