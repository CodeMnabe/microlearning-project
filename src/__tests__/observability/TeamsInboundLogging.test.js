import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SENTINELS = Object.freeze([
  "PRIVATE_MESSAGE_SENTINEL",
  "https://example.invalid/path?token=secret-link-value",
  "super-secret-token-should-not-appear",
  "PROVIDER_RESPONSE_SECRET_SENTINEL",
]);

vi.mock("@/lib/repos/assistants.repo", () => ({
  getAssistantById: vi.fn(),
  getFirstAssistantInOrg: vi.fn(),
}));
vi.mock("@/lib/services/oAi.services", () => ({
  createOAiThread: vi.fn(),
  sendMessageToAi: vi.fn(),
}));
vi.mock("@/lib/repos/organizations.repo", () => ({
  getOrganizationByTeamsTenantId: vi.fn(),
}));
vi.mock("@/lib/repos/messages.repo", () => ({ createMessage: vi.fn() }));
vi.mock("@/lib/repos/user.repo", () => ({
  getUserByAadObjectId: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("@/lib/repos/threads.repo", () => ({
  createThread: vi.fn(),
  getUserThreadForChannel: vi.fn(),
  getGroupThreadForConversation: vi.fn(),
}));
vi.mock("@/lib/repos/teamsInstallations.repo", () => ({
  upsertTeamsInstallation: vi.fn(),
}));
vi.mock("@/lib/teams/auth", () => ({
  getBotToken: vi.fn(async () => SENTINELS[2]),
}));
vi.mock("@/lib/auth/guards", () => ({
  handleApiError: vi.fn(),
  requireValidTeamsRequest: vi.fn(),
}));
vi.mock("@/lib/repos/webhookEvents.repo", () => ({
  registerWebhookEvent: vi.fn(),
}));
vi.mock("@/lib/webhooks/eventIdentity", () => ({
  buildTeamsEventIdentity: vi.fn(),
  getTeamsTenantId: vi.fn(),
}));
vi.mock("@/lib/webhooks/effectRunner", () => ({
  runWebhookEffect: vi.fn(async ({ operation }) => operation()),
}));
vi.mock("@/lib/webhooks/conversationReservation", () => ({
  getOrCreateReservedThread: vi.fn(),
}));

import { processTeamsWebhookEvent } from "@/app/api/teams/messages/route";

function activity() {
  return {
    id: "external-message-sentinel",
    type: "message",
    text: `--help ${SENTINELS[0]}`,
    serviceUrl: SENTINELS[1],
    conversation: { id: "external-conversation-sentinel" },
    from: { id: "external-user-sentinel" },
    channelData: { tenant: { id: "external-tenant-sentinel" } },
  };
}

function captureConsole() {
  const lines = [];
  const spies = ["info", "warn", "error"].map((level) =>
    vi
      .spyOn(console, level)
      .mockImplementation((value) => lines.push(String(value))),
  );
  return { lines, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}

function expectNoSentinels(lines) {
  const output = lines.join("\n");
  for (const sentinel of SENTINELS) expect(output).not.toContain(sentinel);
}

describe("Teams inbound operational logging", () => {
  let capture;

  beforeEach(() => {
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
    vi.unstubAllGlobals();
  });

  it("logs command receipt without the activity or command content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 201, text: async () => "" })),
    );
    await processTeamsWebhookEvent(activity());
    expect(capture.lines.join("\n")).toContain("teams_message_received");
    expectNoSentinels(capture.lines);
  });

  it("logs provider rejection without the response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => SENTINELS[3],
      })),
    );
    await expect(processTeamsWebhookEvent(activity())).rejects.toThrow(
      "Teams rejected reply",
    );
    expect(capture.lines.join("\n")).toContain("provider_request_failed");
    expectNoSentinels(capture.lines);
  });
});
