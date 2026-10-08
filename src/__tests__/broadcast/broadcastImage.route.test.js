import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnedOrg: vi.fn(),
  generateBroadcastImage: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwnedOrg: mocks.requireOwnedOrg,
  jsonError(message, status = 400) {
    return Response.json({ error: message }, { status });
  },
  handleApiError(error, fallback) {
    return Response.json({ error: error.message || fallback }, { status: 500 });
  },
}));

vi.mock("@/lib/services/broadcast/generateBroadcastImage", () => ({
  IMAGE_PROMPT_MAX_LENGTH: 600,
  generateBroadcastImage: mocks.generateBroadcastImage,
}));

import { POST } from "@/app/api/broadcast/image/route";

const request = (body) => ({ json: () => Promise.resolve(body) });

describe("POST /api/broadcast/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("só o dono da organização pede imagens", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await POST(request({ orgId: 9, prompt: "um café" }));

    expect(response.status).toBe(403);
    expect(mocks.generateBroadcastImage).not.toHaveBeenCalled();
  });

  it.each([
    ["sem pedido", "   "],
    ["com um pedido longo demais", "a".repeat(601)],
  ])("recusa um pedido %s, sem gastar na OpenAI", async (_, prompt) => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });

    const response = await POST(request({ orgId: 7, prompt }));

    expect(response.status).toBe(400);
    expect(mocks.generateBroadcastImage).not.toHaveBeenCalled();
  });

  it("devolve a imagem e regista os tokens gastos, sem os mandar ao browser", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.generateBroadcastImage.mockResolvedValue({
      image: "QUJD",
      contentType: "image/jpeg",
      usage: { output_tokens: 1056 },
    });

    const response = await POST(request({ orgId: 7, prompt: " um café " }));

    expect(response.status).toBe(200);
    expect(mocks.generateBroadcastImage).toHaveBeenCalledWith({
      prompt: "um café",
    });
    expect(await response.json()).toEqual({
      image: "QUJD",
      contentType: "image/jpeg",
    });
    expect(console.info).toHaveBeenCalledWith(
      "[Broadcast] image generated",
      { orgId: 7, usage: { output_tokens: 1056 } },
    );
  });

  it("se a OpenAI falhar, responde 502", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({ orgId: 7 });
    mocks.generateBroadcastImage.mockRejectedValue(new Error("moderation"));

    const response = await POST(request({ orgId: 7, prompt: "um café" }));

    expect(response.status).toBe(502);
  });
});
