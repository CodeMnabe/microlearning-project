// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireOrgForAssistant } from "@/lib/auth/guards";
import { createConversation, getConversation, generateAssistantResponse } from "@/lib/services/openaiResponses.service";
import { updateAssistant } from "@/lib/repos/assistants.repo";
import { POST } from "@/app/api/assistants/[assistantId]/messages/route";
import { PATCH } from "@/app/api/assistants/[assistantId]/route";

vi.mock("@/lib/auth/guards", async (importOriginal) => ({
  ...(await importOriginal()),
  requireOrgForAssistant: vi.fn(),
  requireOrgForThread: vi.fn(),
}));
vi.mock("@/lib/services/openaiResponses.service", () => ({
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  generateAssistantResponse: vi.fn(),
}));
vi.mock("@/lib/repos/assistants.repo", () => ({
  updateAssistant: vi.fn(),
  deleteAssistant: vi.fn(),
}));

const assistant = { id: 7, organization_id: 1, model: "gpt-5.6" };
const admin = { from: vi.fn() };
const context = { params: Promise.resolve({ assistantId: "7" }) };
const request = (body) => ({ json: async () => body });

beforeEach(() => {
  vi.resetAllMocks();
  requireOrgForAssistant.mockResolvedValue({ assistant, orgId: 1, assistantId: 7, admin });
  generateAssistantResponse.mockResolvedValue({ aiResponse: "Olá", conversationId: "conv_teste", responseId: "resp_teste" });
});

describe("Propriedade das conversas do assistente", () => {
  it("rejeita uma conversa de outra organização sem gerar resposta ou criar conversa", async () => {
    getConversation.mockResolvedValue({ metadata: { assistantId: "7", organizationId: "2", scope: "sandbox" } });
    const response = await POST(request({ message: "Olá", conversationId: "conv_teste" }), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Conversation not found" });
    expect(generateAssistantResponse).not.toHaveBeenCalled();
    expect(createConversation).not.toHaveBeenCalled();
  });

  it("aceita a conversa sandbox do assistente e organização autorizados", async () => {
    getConversation.mockResolvedValue({ metadata: { assistantId: "7", organizationId: "1", scope: "sandbox" } });
    const response = await POST(request({ message: "Olá", conversationId: "conv_teste" }), context);
    expect(response.status).toBe(200);
    expect(getConversation).toHaveBeenCalledWith("conv_teste");
    expect(generateAssistantResponse).toHaveBeenCalledWith({ assistant, conversationId: "conv_teste", message: "Olá" });
    expect(createConversation).not.toHaveBeenCalled();
  });

  it("cria a conversa na primeira mensagem com identificador vazio", async () => {
    createConversation.mockResolvedValue({ id: "conv_nova" });
    const response = await POST(request({ message: "Olá", conversationId: "" }), context);
    expect(response.status).toBe(200);
    expect(createConversation).toHaveBeenCalledWith({ assistantId: 7, organizationId: 1, channel: "web", scope: "sandbox" });
    expect(getConversation).not.toHaveBeenCalled();
    expect(generateAssistantResponse).toHaveBeenCalledWith({ assistant, conversationId: "conv_nova", message: "Olá" });
  });

  it("ignora vector_store_id no PATCH sem consultar vector_store", async () => {
    updateAssistant.mockResolvedValue({ ...assistant, name: "X" });
    const response = await PATCH(request({ vector_store_id: 999, name: "X" }), context);
    expect(response.status).toBe(200);
    expect(updateAssistant).toHaveBeenCalledWith(7, { name: "X" });
    expect(admin.from).not.toHaveBeenCalled();
  });
});
