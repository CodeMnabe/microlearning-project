import { beforeEach, describe, expect, it, vi } from "vitest";

const contactMocks = vi.hoisted(() => ({ createDeduplicatedContact: vi.fn() }));
const captchaMocks = vi.hoisted(() => ({ verifyContactCaptcha: vi.fn() }));
const capacityMocks = vi.hoisted(() => ({ consumeCapacitySet: vi.fn() }));

vi.mock("@/lib/repos/contact.repo", () => contactMocks);
vi.mock("@/lib/services/contact/turnstile", () => captchaMocks);
vi.mock("@/lib/repos/requestCapacity.repo", () => capacityMocks);

import { POST } from "@/app/api/contact/route.js";

const VALID = {
  name: "Ana Silva",
  email: "ana@example.test",
  company: "Example",
  message: "Quero saber mais sobre o produto.",
  captchaToken: "captcha-test-token",
};

function makeRequest(body = VALID, headers = {}) {
  return new Request("https://app.example/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("Public contact submission controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABUSE_IDENTITY_SECRET =
      "test-secret-with-at-least-thirty-two-bytes";
    captchaMocks.verifyContactCaptcha.mockResolvedValue(true);
    capacityMocks.consumeCapacitySet.mockResolvedValue({ accepted: true });
    contactMocks.createDeduplicatedContact.mockResolvedValue({
      accepted: true,
      contactId: 1,
    });
  });

  it("accepts a bounded valid body", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(202);
    expect(contactMocks.createDeduplicatedContact).toHaveBeenCalledTimes(1);
  });

  it("rejects a declared body above the limit", async () => {
    const response = await POST(
      makeRequest(VALID, { "content-length": "20000" }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects a streamed body above the limit without Content-Length", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(`{"message":"${"x".repeat(17000)}"}`),
        );
        controller.close();
      },
    });
    const response = await POST(
      new Request("https://app.example/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects invalid JSON", async () => {
    expect((await POST(makeRequest("{"))).status).toBe(400);
  });

  it("rejects an invalid content type", async () => {
    expect(
      (
        await POST(
          makeRequest(JSON.stringify(VALID), { "content-type": "text/plain" }),
        )
      ).status,
    ).toBe(415);
  });

  it("rejects unknown and nested fields", async () => {
    expect((await POST(makeRequest({ ...VALID, extra: "x" }))).status).toBe(
      400,
    );
    expect(
      (await POST(makeRequest({ ...VALID, name: { value: "Ana" } }))).status,
    ).toBe(400);
  });

  it.each([
    ["name", "x".repeat(121)],
    ["email", `${"x".repeat(250)}@e.test`],
    ["company", "x".repeat(161)],
    ["message", "x".repeat(4001)],
  ])("rejects %s above its limit", async (field, value) => {
    expect((await POST(makeRequest({ ...VALID, [field]: value }))).status).toBe(
      400,
    );
  });

  it("rejects control and problematic Unicode characters", async () => {
    expect(
      (await POST(makeRequest({ ...VALID, name: "Ana\u0000Silva" }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          makeRequest({ ...VALID, message: "Mensagem \u202e problemática" }),
        )
      ).status,
    ).toBe(400);
  });

  it("rejects an invalid email", async () => {
    expect(
      (await POST(makeRequest({ ...VALID, email: "not-an-email" }))).status,
    ).toBe(400);
  });

  it("rejects a missing CAPTCHA token without checking capacity", async () => {
    const { captchaToken: _removed, ...body } = VALID;
    expect((await POST(makeRequest(body))).status).toBe(400);
    expect(captchaMocks.verifyContactCaptcha).not.toHaveBeenCalled();
    expect(capacityMocks.consumeCapacitySet).not.toHaveBeenCalled();
  });

  it.each(["invalid", "timeout", "hostname/action mismatch"])(
    "rejects CAPTCHA %s without consuming capacity",
    async () => {
      captchaMocks.verifyContactCaptcha.mockResolvedValue(false);
      const response = await POST(makeRequest());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Unable to submit the form.",
      });
      expect(capacityMocks.consumeCapacitySet).not.toHaveBeenCalled();
    },
  );

  it("accepts a valid CAPTCHA", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(202);
    expect(captchaMocks.verifyContactCaptcha).toHaveBeenCalledWith(
      VALID.captchaToken,
    );
  });

  it.each(["contact-ip", "contact-email"])(
    "returns 429 without revealing the %s scope",
    async () => {
      capacityMocks.consumeCapacitySet.mockResolvedValue({
        accepted: false,
        retryAfterSeconds: 37,
      });
      const response = await POST(makeRequest());
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("37");
      expect(await response.json()).toEqual({
        error: "Unable to submit the form.",
      });
      expect(captchaMocks.verifyContactCaptcha).toHaveBeenCalled();
      expect(contactMocks.createDeduplicatedContact).not.toHaveBeenCalled();
    },
  );

  it("evaluates the global rate limit before IP and email limits", async () => {
    capacityMocks.consumeCapacitySet.mockResolvedValue({ accepted: true });
    await POST(makeRequest());
    const entries = capacityMocks.consumeCapacitySet.mock.calls[0][0];
    expect(entries[0].scope).toBe("contact-global");
    expect(entries[1].scope).toBe("contact-ip");
    expect(entries[2].scope).toBe("contact-email");
  });

  it("does not create contacts or specific buckets when global rate limit is exhausted", async () => {
    capacityMocks.consumeCapacitySet.mockResolvedValue({
      accepted: false,
      retryAfterSeconds: 42,
    });
    const response = await POST(makeRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");

    expect(captchaMocks.verifyContactCaptcha).toHaveBeenCalledTimes(1);
    const captchaOrder =
      captchaMocks.verifyContactCaptcha.mock.invocationCallOrder[0];
    const capacityOrder =
      capacityMocks.consumeCapacitySet.mock.invocationCallOrder[0];
    expect(captchaOrder).toBeLessThan(capacityOrder);

    const entries = capacityMocks.consumeCapacitySet.mock.calls[0][0];
    expect(entries[0].scope).toBe("contact-global");
    expect(entries[1].scope).toBe("contact-ip");
    expect(entries[2].scope).toBe("contact-email");

    expect(contactMocks.createDeduplicatedContact).not.toHaveBeenCalled();
  });

  it("does not amplify writes for a duplicate in the same window", async () => {
    contactMocks.createDeduplicatedContact.mockResolvedValue({
      accepted: false,
      contactId: 1,
    });
    const response = await POST(makeRequest());
    expect(response.status).toBe(202);
    expect(contactMocks.createDeduplicatedContact).toHaveBeenCalledTimes(1);
  });

  it("passes no CAPTCHA token to persistence", async () => {
    await POST(makeRequest());
    expect(
      JSON.stringify(contactMocks.createDeduplicatedContact.mock.calls),
    ).not.toContain(VALID.captchaToken);
  });

  it("keeps submitted content and identities out of structured logs", async () => {
    const sink = vi.spyOn(console, "error").mockImplementation(() => undefined);
    contactMocks.createDeduplicatedContact.mockRejectedValue(
      new Error(
        `${VALID.email} ${VALID.message} ${VALID.captchaToken} 192.0.2.10`,
      ),
    );
    const response = await POST(makeRequest());
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(sink.mock.calls);
    expect(serialized).not.toContain(VALID.email);
    expect(serialized).not.toContain(VALID.message);
    expect(serialized).not.toContain(VALID.captchaToken);
    expect(serialized).not.toContain("192.0.2.10");
    sink.mockRestore();
  });
});
