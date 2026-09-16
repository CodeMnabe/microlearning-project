// @vitest-environment node
import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, after } from "next/server";
import { recordWebhookEvent } from "@/lib/repos/webhookEvents.repo";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal()),
  after: vi.fn(),
}));
vi.mock("@/lib/repos/webhookEvents.repo");
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@/lib/openai/client", () => ({ openai: {} }));

process.env.MESSAGEBIRD_SIGNING_KEY = "teste";
const { POST } = await import("@/app/api/messagebird/route");

function signedRequest() {
  const fullUrl = "http://127.0.0.1:3000/api/messagebird";
  const body = JSON.stringify({
    service: "channels",
    event: "whatsapp.inbound",
    payload: { id: "msg_1", body: { type: "text", text: { text: "olá" } } },
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac("sha256", "teste")
    .update(Buffer.concat([
      Buffer.from(`${ts}\n${fullUrl}\n`),
      crypto.createHash("sha256").update(body).digest(),
    ]))
    .digest("base64");
  return new NextRequest(fullUrl, {
    method: "POST",
    body,
    headers: {
      "messagebird-signature": signature,
      "messagebird-request-timestamp": ts,
      "x-forwarded-proto": "http",
      "x-forwarded-host": "127.0.0.1:3000",
    },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("deduplicação do webhook do Bird", () => {
  it("ignora eventos repetidos sem agendar processamento", async () => {
    recordWebhookEvent.mockResolvedValue({ inserted: false });
    const response = await POST(signedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(after).not.toHaveBeenCalled();
  });

  it("pede repetição quando a gravação falha", async () => {
    recordWebhookEvent.mockRejectedValue(new Error("Supabase indisponível"));
    const response = await POST(signedRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "temporarily unavailable" });
    expect(after).not.toHaveBeenCalled();
  });

  it("grava a chave de entrada e agenda um evento novo", async () => {
    recordWebhookEvent.mockResolvedValue({ inserted: true, id: 9 });
    const response = await POST(signedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(after).toHaveBeenCalledTimes(1);
    expect(recordWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKey: "inbound:msg_1",
    }));
  });
});
