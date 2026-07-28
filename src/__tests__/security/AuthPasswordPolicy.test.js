import { describe, it, expect } from "vitest";
import {
  validatePassword,
  validatePasswordWithConfirmation,
  PASSWORD_POLICY,
} from "@/lib/auth/passwordPolicy";

describe("AuthPasswordPolicy", () => {
  it("rejects password under 12 chars", () => {
    expect(validatePassword("Short1!").length).toBeGreaterThan(0);
  });

  it("rejects password without lowercase", () => {
    expect(validatePassword("NOLOWERCASE123!").length).toBeGreaterThan(0);
  });

  it("rejects password without uppercase", () => {
    expect(validatePassword("nouppercase123!").length).toBeGreaterThan(0);
  });

  it("rejects password without digit", () => {
    expect(validatePassword("NoDigitsHere!").length).toBeGreaterThan(0);
  });

  it("rejects password without symbol", () => {
    expect(validatePassword("NoSymbolHere123").length).toBeGreaterThan(0);
  });

  it("rejects whitespace-only password", () => {
    expect(validatePassword("            ").length).toBeGreaterThan(0);
  });

  it("rejects password over 128 bytes", () => {
    const longPass = "A1!a" + "b".repeat(125);
    expect(validatePassword(longPass).length).toBeGreaterThan(0);
  });

  it("rejects confirmation mismatch", () => {
    expect(
      validatePasswordWithConfirmation("ValidPass123!", "ValidPass123?").length,
    ).toBeGreaterThan(0);
  });

  it("accepts valid password", () => {
    expect(validatePassword("Str0ng!Pass99").length).toBe(0);
  });

  it("accepts exactly 12 char valid password", () => {
    expect(validatePassword("Str0ng!Pas99").length).toBe(0);
  });

  it("password never appears in error messages", () => {
    const badPass = "P@ssw";
    const errors = validatePassword(badPass);
    expect(JSON.stringify(errors)).not.toContain(badPass);
  });
});
