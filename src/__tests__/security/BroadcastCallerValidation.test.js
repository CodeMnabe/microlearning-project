import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnedOrg: vi.fn(),
  assertUsersBelongToOrg: vi.fn(),
  assertWhatsappTemplateBelongsToOrg: vi.fn(),
  assertWhatsappProviderTemplateBelongsToOrg: vi.fn(),
  sendWhatsappBroadcast: vi.fn(),
  sendTeamsBroadcast: vi.fn(),
  createScheduledBroadcast: vi.fn(),
  isReadChainsEnabled: vi.fn(),
  createMessageChain: vi.fn(),
  createMessageChainSteps: vi.fn(),
  createMessageChainRecipients: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwnedOrg: mocks.requireOwnedOrg,
  assertUsersBelongToOrg: mocks.assertUsersBelongToOrg,
  assertWhatsappTemplateBelongsToOrg:
    mocks.assertWhatsappTemplateBelongsToOrg,
  assertWhatsappProviderTemplateBelongsToOrg:
    mocks.assertWhatsappProviderTemplateBelongsToOrg,
  requireAllRecipientsToBeKnownUsers: (recipients) =>
    recipients.map((recipient) => recipient.userId),
  handleApiError: (error) =>
    Response.json({ error: error.message }, { status: error.status || 500 }),
  jsonError: (message, status) => Response.json({ error: message }, { status }),
}));
vi.mock("@/lib/services/broadcast/sendWhatsappBroadcast", () => ({
  sendWhatsappBroadcast: mocks.sendWhatsappBroadcast,
}));
vi.mock("@/lib/services/broadcast/sendTeamsBroadcast", () => ({
  sendTeamsBroadcast: mocks.sendTeamsBroadcast,
}));
vi.mock("@/lib/repos/scheduledBroadcasts.repo", () => ({
  createScheduledBroadcast: mocks.createScheduledBroadcast,
}));
vi.mock("@/lib/repos/organizationMessagingFeature.repo", () => ({
  isReadChainsEnabled: mocks.isReadChainsEnabled,
}));
vi.mock("@/lib/repos/messageChain.repo", () => ({
  createMessageChain: mocks.createMessageChain,
  createMessageChainSteps: mocks.createMessageChainSteps,
  createMessageChainRecipients: mocks.createMessageChainRecipients,
}));
vi.mock("@/lib/services/broadcast/readChains/sendReadChainStep", () => ({
  sendReadChainStep: mocks.sendWhatsappBroadcast,
}));

import { POST as postWhatsapp } from "@/app/api/broadcast/whatsapp/route.js";
import { POST as postTeams } from "@/app/api/broadcast/teams/route.js";
import { POST as postSchedule } from "@/app/api/broadcast/schedule/route.js";
import { POST as postReadChain } from "@/app/api/broadcast/read-chain/route.js";

const invalidLink = {
  key: "test",
  label: "Test",
  destinationUrl:
    "javascript:document.body.dataset.securityTest='executed'",
};

describe("SEC-01 broadcast caller validation", () => {
  it.each([
    ["whatsapp", postWhatsapp, { recipients: [{ userId: 1 }] }],
    ["teams", postTeams, { recipients: [{ userId: 1 }] }],
    [
      "schedule",
      postSchedule,
      {
        channel: "teams",
        scheduledFor: "2099-01-01T00:00:00.000Z",
        timezone: "UTC",
        payload: { userIds: [1], trackedLinks: [invalidLink] },
      },
    ],
  ])("returns HTTP 400 before persistence for %s", async (_name, handler, extra) => {
    mocks.requireOwnedOrg.mockResolvedValue({
      orgId: 1,
      admin: {},
      user: { id: 1 },
    });

    const body = {
      orgId: 1,
      message: "test",
      ...extra,
    };

    if (_name !== "schedule") body.trackedLinks = [invalidLink];

    const response = await handler(
      new Request("https://app.example/api/test", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.sendWhatsappBroadcast).not.toHaveBeenCalled();
    expect(mocks.sendTeamsBroadcast).not.toHaveBeenCalled();
    expect(mocks.createScheduledBroadcast).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 before creating a read-chain step", async () => {
    mocks.requireOwnedOrg.mockResolvedValue({
      orgId: 1,
      admin: {},
      user: { id: 1 },
    });

    const response = await postReadChain(
      new Request("https://app.example/api/broadcast/read-chain", {
        method: "POST",
        body: JSON.stringify({
          orgId: 1,
          recipients: [{ userId: 1 }],
          steps: [
            {
              message: "test",
              trackedLinks: [invalidLink],
            },
          ],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createMessageChain).not.toHaveBeenCalled();
    expect(mocks.createMessageChainSteps).not.toHaveBeenCalled();
  });
});
