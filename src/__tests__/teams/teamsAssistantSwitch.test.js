import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/assistants.repo", () => ({ getAssistantsInOrg: vi.fn() }));
vi.mock("@/lib/repos/user.repo", () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));

import {
  ASSISTANT_SWITCH_ACTION,
  handleTeamsAssistantSwitch,
} from "@/lib/services/teams/teamsAssistantSwitch";

const USER = {
  id: 3,
  organization_id: 1,
  assistant_id: 7,
  assistant_ids: [7, 9],
};

const ASSISTANTS = [
  { id: 9, name: "Vendas" },
  { id: 7, name: "Formação" },
  { id: 12, name: "Outro da org" },
];

describe("Teams assistant switch", () => {
  let deps;
  let send;

  beforeEach(() => {
    send = vi.fn(async () => ({ ok: true }));
    deps = {
      getUserById: vi.fn(async () => USER),
      getAssistantsInOrg: vi.fn(async () => ASSISTANTS),
      updateUser: vi.fn(async () => ({})),
    };
  });

  it("answers the keyword with a card of the user's assistants", async () => {
    const result = await handleTeamsAssistantSwitch({
      userId: 3,
      text: "Assistentes",
      send,
      deps,
    });

    expect(result).toMatchObject({ handled: true, outcome: "menu" });

    const card = send.mock.calls[0][0].attachments[0].content;
    expect(card.body[0].text).toContain("Agora estás com Formação.");
    expect(card.actions.map((a) => a.data.assistantId)).toEqual([7, 9]);
  });

  it("switches the active assistant on a tap and confirms", async () => {
    const result = await handleTeamsAssistantSwitch({
      userId: 3,
      text: "Vendas",
      value: { action: ASSISTANT_SWITCH_ACTION, assistantId: 9 },
      send,
      deps,
    });

    expect(result).toMatchObject({ handled: true, outcome: "switched" });
    expect(deps.updateUser).toHaveBeenCalledWith(3, { assistantId: 9 });
    expect(send.mock.calls[0][0].text).toContain("Agora estás a falar com Vendas.");
  });

  it("uses a choice list with a single button when there are many", async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: 20 + i, name: `A${i}` }));
    deps.getUserById.mockResolvedValue({
      ...USER,
      assistant_id: 21,
      assistant_ids: many.map((a) => a.id),
    });
    deps.getAssistantsInOrg.mockResolvedValue(many);

    await handleTeamsAssistantSwitch({ userId: 3, text: "assistentes", send, deps });

    const card = send.mock.calls[0][0].attachments[0].content;
    expect(card.body[1]).toMatchObject({ type: "Input.ChoiceSet", value: "21" });
    expect(card.body[1].choices).toHaveLength(6);
    expect(card.actions).toHaveLength(1);
  });

  it("lets the keyword reach the assistant when there is only one", async () => {
    deps.getUserById.mockResolvedValue({ ...USER, assistant_ids: [7] });

    const result = await handleTeamsAssistantSwitch({
      userId: 3,
      text: "assistentes",
      send,
      deps,
    });

    expect(result).toEqual({ handled: false });
    expect(send).not.toHaveBeenCalled();
  });
});
