import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/assistants.repo", () => ({ getAssistantsInOrg: vi.fn() }));
vi.mock("@/lib/repos/messages.repo", () => ({ createMessage: vi.fn() }));
vi.mock("@/lib/repos/threads.repo", () => ({
  getUserThreadForChannel: vi.fn(),
}));
vi.mock("@/lib/repos/user.repo", () => ({
  setUserAssistantMenu: vi.fn(),
  updateUser: vi.fn(),
}));

import { getAssistantsInOrg } from "@/lib/repos/assistants.repo";
import { setUserAssistantMenu, updateUser } from "@/lib/repos/user.repo";
import { handleAssistantSwitch } from "@/lib/services/assistants/handleAssistantSwitch";

const ASSISTANTS = [
  { id: 7, name: "Vendas" },
  { id: 8, name: "Segurança" },
  { id: 9, name: "Outro da organização" },
];

const USER = {
  id: 42,
  organization_id: 1,
  assistant_id: 7,
  assistant_ids: [7, 8],
  assistant_menu_message_id: "menu-1",
  assistant_menu_sent_at: null,
};

const textPayload = (text) => ({ body: { type: "text", text: { text } } });

describe("handleAssistantSwitch", () => {
  let send;

  beforeEach(() => {
    vi.clearAllMocks();
    getAssistantsInOrg.mockResolvedValue(ASSISTANTS);
    send = vi.fn().mockResolvedValue({ ok: true, providerMessageId: "menu-2" });
  });

  it("a palavra-chave envia o menu só com os assistentes do contacto", async () => {
    const result = await handleAssistantSwitch({
      user: USER,
      payload: textPayload("Assistentes"),
      send,
    });

    expect(result).toMatchObject({ handled: true, outcome: "menu" });
    expect(send.mock.calls[0][0].actions.map((a) => a.reply.text)).toEqual([
      "Segurança",
      "Vendas",
    ]);
    expect(setUserAssistantMenu).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ messageId: "menu-2" }),
    );
  });

  it("um toque num botão do menu muda o assistente ativo e confirma", async () => {
    const result = await handleAssistantSwitch({
      user: USER,
      payload: {
        replyTo: { id: "menu-1" },
        body: {
          type: "text",
          text: {
            text: "Segurança",
            actions: [
              {
                type: "postback",
                postback: { text: "Segurança", payload: "item_0" },
              },
            ],
          },
        },
      },
      send,
    });

    expect(result).toMatchObject({ outcome: "switched", assistantId: 8 });
    expect(updateUser).toHaveBeenCalledWith(42, { assistantId: 8 });
    expect(send.mock.calls[0][0].text).toContain("Segurança");
  });

  it("deixa passar mensagens normais e contactos com um só assistente", async () => {
    const normal = await handleAssistantSwitch({
      user: USER,
      payload: textPayload("2"),
      send,
    });

    const single = await handleAssistantSwitch({
      user: { ...USER, assistant_ids: [7] },
      payload: textPayload("assistentes"),
      send,
    });

    expect(normal).toEqual({ handled: false });
    expect(single).toEqual({ handled: false });
    expect(send).not.toHaveBeenCalled();
  });
});
