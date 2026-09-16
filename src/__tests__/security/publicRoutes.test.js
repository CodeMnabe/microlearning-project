// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAllowedDestinationUrl } from "@/lib/security/destinationUrl";
import { createContact } from "@/lib/repos/contact.repo";
import { POST } from "@/app/api/contact/route";

vi.mock("@/lib/repos/contact.repo", () => ({
  createContact: vi.fn().mockResolvedValue(false),
  hasRecentContactFromEmail: vi.fn().mockResolvedValue(false),
}));

beforeEach(() => vi.clearAllMocks());

const validBody = {
  name: "João",
  email: "joao@exemplo.pt",
  company: "Exemplo",
  message: "Olá",
};

describe("proteções das rotas públicas", () => {
  it("rejeita javascript e aceita destinos HTTPS", () => {
    expect(isAllowedDestinationUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedDestinationUrl("https://exemplo.pt/x")).toBe(true);
  });

  it("aceita o honeypot sem criar contacto", async () => {
    const body = { ...validBody, website: "x" };
    const response = await POST({ json: async () => body, headers: new Headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("rejeita mensagens acima do limite sem criar contacto", async () => {
    const body = { ...validBody, message: "x".repeat(5000) };
    const response = await POST({ json: async () => body, headers: new Headers() });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Field too long" });
    expect(createContact).not.toHaveBeenCalled();
  });
});
