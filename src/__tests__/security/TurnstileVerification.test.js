import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyContactCaptcha } from "@/lib/services/contact/turnstile";

describe("Contact CAPTCHA verification", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "explicit-test-secret";
    process.env.TURNSTILE_EXPECTED_ACTION = "contact";
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = "app.example,www.example";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a valid hostname and action", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, hostname: "app.example", action: "contact" }),
    });
    await expect(verifyContactCaptcha("token", { fetchImpl })).resolves.toBe(true);
    const request = fetchImpl.mock.calls[0][1];
    expect(String(request.body)).toContain("response=token");
  });

  it.each([
    [{ success: false, hostname: "app.example", action: "contact" }, "invalid"],
    [{ success: true, hostname: "wrong.example", action: "contact" }, "hostname"],
    [{ success: true, hostname: "app.example", action: "wrong" }, "action"],
  ])("rejects an invalid provider result for %s", async (result) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    await expect(verifyContactCaptcha("token", { fetchImpl })).resolves.toBe(false);
  });

  it("fails closed on timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const verification = verifyContactCaptcha("token", { fetchImpl });
    await vi.advanceTimersByTimeAsync(3001);
    await expect(verification).resolves.toBe(false);
  });

  it("treats missing configuration as a secure configuration error", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(verifyContactCaptcha("token", { fetchImpl: vi.fn() })).rejects.toThrow(
      "Turnstile configuration is incomplete",
    );
  });
});
