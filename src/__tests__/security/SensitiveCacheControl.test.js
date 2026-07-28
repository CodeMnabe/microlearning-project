import { describe, expect, it } from "vitest";
import {
  applySensitiveCacheControl,
  mergeSensitiveCacheControl,
  SENSITIVE_CACHE_CONTROL,
} from "@/lib/security/cacheControl";

describe("sensitive Cache-Control policy", () => {
  it("produz a política mínima obrigatória", () => {
    expect(mergeSensitiveCacheControl()).toBe(SENSITIVE_CACHE_CONTROL);
    expect(mergeSensitiveCacheControl(null)).toBe(SENSITIVE_CACHE_CONTROL);
  });

  it("preserva diretivas mais restritivas sem duplicar as obrigatórias", () => {
    expect(mergeSensitiveCacheControl("no-store, max-age=0, private")).toBe(
      "private, no-store, no-cache, must-revalidate, max-age=0",
    );
  });

  it.each(["public", "s-maxage=60", "stale-while-revalidate=30"])(
    "remove a diretiva de cache partilhada %s",
    (directive) => {
      const value = mergeSensitiveCacheControl(`no-store, ${directive}`);
      expect(value).not.toContain(directive);
      expect(value).toContain("private");
      expect(value).toContain("no-store");
    },
  );

  it("aplica a política à resposta final", () => {
    const response = new Response(null, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });

    expect(applySensitiveCacheControl(response)).toBe(response);
    expect(response.headers.get("Cache-Control")).toBe(SENSITIVE_CACHE_CONTROL);
  });
});
