// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  groups: vi.fn(),
  createMessage: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/teams/auth", () => ({ getBotToken: async () => "token" }));
vi.mock("@/lib/openai/client", () => ({
  openai: { conversations: { items: { create: vi.fn() } } },
}));
vi.mock("@/lib/services/openaiResponses.service", () => ({
  createConversation: vi.fn(),
}));
vi.mock("@/lib/repos/organizations.repo", () => ({
  getOrganization: async () => ({ id: 7, name: "DIGIK" }),
}));
vi.mock("@/lib/repos/teamsInstallations.repo", () => ({
  getGroupInstallationsByIds: mocks.groups,
}));
vi.mock("@/lib/repos/messages.repo", () => ({
  createMessage: mocks.createMessage,
}));
vi.mock("@/lib/repos/threads.repo", () => ({
  getGroupThreadForConversation: async () => ({
    id: 40,
    openai_conversation_id: "conv_1",
  }),
  createThread: vi.fn(),
}));

import { stripBotMention } from "@/lib/teams/mentions";
import { belongsToGroupConversation } from "@/lib/services/teams/teamsGroups.service";
import { sendTeamsGroupBroadcast } from "@/lib/services/broadcast/sendTeamsGroupBroadcast";
import { getChannelPostContext } from "@/lib/services/teams/channelPostContext";

describe("stripBotMention", () => {
  it("tira a menção ao bot e deixa os comandos chegar intactos", () => {
    const activity = {
      text: "<at>MyDigitalBot</at>&nbsp;--help",
      recipient: { id: "28:bot" },
      entities: [
        {
          type: "mention",
          text: "<at>MyDigitalBot</at>",
          mentioned: { id: "28:bot" },
        },
      ],
    };

    expect(stripBotMention(activity)).toBe("--help");
  });

  it("mantém o nome das outras pessoas mencionadas", () => {
    const activity = {
      text: "<at>MyDigitalBot</at> o que achas da ideia da <at>Ana Silva</at>?",
      recipient: { id: "28:bot" },
      entities: [
        {
          type: "mention",
          text: "<at>MyDigitalBot</at>",
          mentioned: { id: "28:bot" },
        },
        {
          type: "mention",
          text: "<at>Ana Silva</at>",
          mentioned: { id: "29:ana" },
        },
      ],
    };

    expect(stripBotMention(activity)).toBe(
      "o que achas da ideia da Ana Silva?",
    );
  });
});

describe("belongsToGroupConversation", () => {
  it("junta ao grupo as publicações do canal e mais nada", () => {
    const channel = "19:abc@thread.tacv2";

    expect(belongsToGroupConversation(channel, channel)).toBe(true);
    expect(
      belongsToGroupConversation(`${channel};messageid=171`, channel),
    ).toBe(true);
    expect(belongsToGroupConversation("19:abc@thread.tacv2x", channel)).toBe(
      false,
    );
    expect(belongsToGroupConversation(channel, "")).toBe(false);
  });
});

describe("sendTeamsGroupBroadcast", () => {
  const group = {
    id: 5,
    organization_id: 7,
    assistant_id: 9,
    tenant_id: "t",
    conversation_id: "19:abc@thread.tacv2",
    service_url: "https://smba.trafficmanager.net/emea/",
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "act-1" }),
    });
  });

  it("não envia para um grupo de onde o bot saiu", async () => {
    mocks.groups.mockResolvedValue([{ ...group, is_active: false }]);

    const result = await sendTeamsGroupBroadcast({
      orgId: 7,
      groupIds: [5],
      message: "Olá",
    });

    expect(result).toMatchObject({ ok: 0, failed: 1 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("publica no grupo sem o nome de ninguém e guarda como enviada pela plataforma", async () => {
    mocks.groups.mockResolvedValue([group]);

    const result = await sendTeamsGroupBroadcast({
      orgId: 7,
      groupIds: [5],
      message: "Olá {{nome}}, novidades da {{empresa}}",
    });

    expect(result).toMatchObject({ ok: 1, failed: 0 });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).text).toBe(
      "Olá , novidades da DIGIK",
    );
    expect(mocks.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 40,
        userId: null,
        assistantId: null,
        messageId: "act-1",
      }),
    );
  });
});

describe("getChannelPostContext", () => {
  it("começa o fio com a publicação enviada pela plataforma e com mais nada", async () => {
    const messages = {
      111: { role: "assistant", content: "Formação na quinta às 10h." },
      222: { role: "user", content: "Pergunta de uma pessoa" },
    };
    const deps = { getMessageByProviderId: async (id) => messages[id] ?? null };
    const context = (conversationId) =>
      getChannelPostContext({ conversationId, organizationId: 7, deps });

    expect(await context("19:abc@thread.tacv2;messageid=111")).toEqual([
      {
        type: "message",
        role: "assistant",
        content: "Formação na quinta às 10h.",
      },
    ]);
    expect(await context("19:abc@thread.tacv2;messageid=222")).toEqual([]);
    expect(await context("19:abc@thread.tacv2")).toEqual([]);
  });
});
