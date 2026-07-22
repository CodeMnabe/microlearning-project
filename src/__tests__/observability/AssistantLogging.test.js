import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  updateAssistant: vi.fn(),
  deleteAssistant: vi.fn(),
  updateOAiAssistant: vi.fn(),
  deleteOAiAssistant: vi.fn(),
  requireOrgForAssistant: vi.fn(),
}));

vi.mock("@/lib/repos/assistants.repo", () => ({
  updateAssistant: mocks.updateAssistant,
  deleteAssistant: mocks.deleteAssistant,
}));

vi.mock("@/lib/services/oAi.services", () => ({
  updateOAiAssistant: mocks.updateOAiAssistant,
  deleteOAiAssistant: mocks.deleteOAiAssistant,
}));

vi.mock("@/lib/auth/guards", () => ({
  assertAssistantBelongsToOrg: vi.fn(),
  cleanPatch: (value) => ({ name: value.name }),
  handleApiError: (_error, fallback) =>
    NextResponse.json({ error: fallback }, { status: 500 }),
  requireOrgForAssistant: mocks.requireOrgForAssistant,
}));

import { PATCH } from "@/app/api/assistants/[assistantId]/route";

describe("assistant logging", () => {
  let lines;
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    lines = [];
    consoleError = vi
      .spyOn(console, "error")
      .mockImplementation((value) => lines.push(String(value)));
    mocks.requireOrgForAssistant.mockResolvedValue({
      orgId: 7,
      assistantId: 8,
      assistant: { id: 8, open_ai_id: "external-assistant-id" },
    });
    mocks.updateOAiAssistant.mockRejectedValue(new Error("provider failure"));
    mocks.updateAssistant.mockResolvedValue({
      id: 8,
      name: "Updated",
      vector_store_id: null,
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("uses orgAuth.orgId as the internal organizationId", async () => {
    const response = await PATCH(
      new Request("http://local.invalid/api/assistants/8", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ assistantId: "8" }) },
    );

    expect(response.status).toBe(200);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual(
      expect.objectContaining({
        event: "openai_operation_failed",
        assistantId: 8,
        organizationId: 7,
      }),
    );
  });
});
