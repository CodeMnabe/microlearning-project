import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTH_REDIRECT,
  getSafeRedirectPath,
} from "@/lib/auth/safeRedirect";

describe("getSafeRedirectPath", () => {
  it("aceita caminhos internos com query string", () => {
    expect(getSafeRedirectPath("/pt/users?page=2")).toBe(
      "/pt/users?page=2",
    );
  });

  it.each(["", "/", "/?from=login", "//evil.example", "/%2Fevil.example", "https://evil.example"])(
    "usa o destino por omissão para %j",
    (value) => {
      expect(getSafeRedirectPath(value)).toBe(DEFAULT_AUTH_REDIRECT);
    },
  );

  it("rejeita caracteres de controlo e caminhos com mais de 256 caracteres", () => {
    expect(getSafeRedirectPath("/users\nadmin")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(getSafeRedirectPath(`/${"a".repeat(256)}`)).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
  });
});
