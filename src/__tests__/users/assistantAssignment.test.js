import { describe, expect, it } from "vitest";
import { resolveAssistantAssignment } from "@/lib/services/users/assistantAssignment";

describe("resolveAssistantAssignment", () => {
  it("mantém o ativo quando continua na lista e promove outro quando sai", () => {
    expect(
      resolveAssistantAssignment({
        currentIds: [1, 2],
        currentActiveId: 2,
        assistantIds: [2, 3],
      }),
    ).toEqual({ ids: [2, 3], activeId: 2 });

    expect(
      resolveAssistantAssignment({
        currentIds: [1, 2],
        currentActiveId: 1,
        assistantIds: [2, 3],
      }),
    ).toEqual({ ids: [2, 3], activeId: 2 });
  });

  it("só com assistantId muda o ativo e junta-o aos atribuídos", () => {
    expect(
      resolveAssistantAssignment({
        currentIds: [1],
        currentActiveId: 1,
        assistantId: 4,
      }),
    ).toEqual({ ids: [1, 4], activeId: 4 });

    expect(
      resolveAssistantAssignment({ currentIds: [1], assistantId: null }),
    ).toEqual({ ids: [], activeId: null });
  });

  it("rejeita um ativo que não está na lista e ignora pedidos sem assistentes", () => {
    expect(() =>
      resolveAssistantAssignment({ assistantIds: [1], assistantId: 9 }),
    ).toThrow(/assistantIds/);

    expect(resolveAssistantAssignment({ currentIds: [1] })).toBeNull();
  });
});
