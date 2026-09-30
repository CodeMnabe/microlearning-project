import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBotToken: vi.fn(),
  getOrganization: vi.fn(),
  getTeamsUserInstallation: vi.fn(),
  getUserById: vi.fn(),
  createMessage: vi.fn(),
  getUserThreadForChannel: vi.fn(),
  resolveTrackedLinksForRecipient: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/teams/auth", () => ({ getBotToken: mocks.getBotToken }));
vi.mock("@/lib/repos/organizations.repo", () => ({
  getOrganization: mocks.getOrganization,
}));
vi.mock("@/lib/repos/teamsInstallations.repo", () => ({
  getTeamsUserInstallation: mocks.getTeamsUserInstallation,
}));
vi.mock("@/lib/repos/user.repo", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/lib/repos/messages.repo", () => ({
  createMessage: mocks.createMessage,
}));
vi.mock("@/lib/repos/threads.repo", () => ({
  getUserThreadForChannel: mocks.getUserThreadForChannel,
}));
vi.mock("@/lib/services/broadcast/trackedLinks", () => ({
  resolveTrackedLinksForRecipient: mocks.resolveTrackedLinksForRecipient,
  replaceTrackedPlaceholders: (message) => message,
}));

import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";

describe("sendTeamsBroadcast records what it sends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mocks.fetch);

    mocks.getBotToken.mockResolvedValue("token");
    mocks.getOrganization.mockResolvedValue({ id: 7, name: "DIGIK" });
    mocks.getTeamsUserInstallation.mockResolvedValue({
      tenant_id: "t",
      service_url: "https://smba.trafficmanager.net/emea/",
      conversation_id: "a:1",
    });
    mocks.getUserById.mockResolvedValue({ id: 3, name: "Ana", assistant_id: 9 });
    mocks.getUserThreadForChannel.mockResolvedValue({ id: 40 });
    mocks.resolveTrackedLinksForRecipient.mockResolvedValue([]);
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: "1727700000000" }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores the Teams activity id so a read receipt can find it", async () => {
    const result = await sendTeamsBroadcast({
      orgId: 7,
      userIds: [3],
      message: "Olá",
      scheduledBroadcastId: 11,
      automationRunId: 12,
    });

    expect(result.ok).toBe(1);
    expect(mocks.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 40,
        userId: 3,
        assistantId: 9,
        channel: "teams",
        messageId: "1727700000000",
        role: "assistant",
        deliveryStatus: "accepted",
        scheduledBroadcastId: 11,
        automationRunId: 12,
      }),
    );
  });

  it("keeps the send as ok when recording fails", async () => {
    mocks.createMessage.mockRejectedValue(new Error("db down"));

    const result = await sendTeamsBroadcast({
      orgId: 7,
      userIds: [3],
      message: "Olá",
    });

    expect(result.ok).toBe(1);
    expect(result.failed).toBe(0);
  });
});
