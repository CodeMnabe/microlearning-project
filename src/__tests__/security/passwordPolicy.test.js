import { describe, expect, it } from "vitest";
import {
  isPasswordAllowed,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/passwordPolicy";

describe("isPasswordAllowed", () => {
  it("rejeita passwords curtas ou sem maiúsculas/minúsculas", () => {
    expect(isPasswordAllowed("Aa!1234")).toBe(false);
    expect(isPasswordAllowed("password!")).toBe(false);
    expect(isPasswordAllowed("PASSWORD!")).toBe(false);
  });

  it("rejeita passwords sem um caráter especial", () => {
    expect(isPasswordAllowed("Password123")).toBe(false);
  });

  it("aceita oito caracteres com todos os requisitos", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(isPasswordAllowed("Passwor!")).toBe(true);
  });
});
