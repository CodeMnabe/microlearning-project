import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maintainScheduledBroadcastLifecycle: vi.fn(),
  claimDueScheduledBroadcasts: vi.fn(),
  renewScheduledBroadcastLease: vi.fn(),
  markScheduledBroadcastSendStarted: vi.fn(),
  completeScheduledBroadcast: vi.fn(),
  sendTeamsBroadcast: vi.fn(),
  sendWhatsappBroadcast: vi.fn(),
}));

vi.mock("@/lib/repos/scheduledBroadcasts.repo", () => ({
  maintainScheduledBroadcastLifecycle: mocks.maintainScheduledBroadcastLifecycle,
  claimDueScheduledBroadcasts: mocks.claimDueScheduledBroadcasts,
  renewScheduledBroadcastLease: mocks.renewScheduledBroadcastLease,
  markScheduledBroadcastSendStarted: mocks.markScheduledBroadcastSendStarted,
  completeScheduledBroadcast: mocks.completeScheduledBroadcast,
}));
vi.mock("@/lib/services/broadcast/sendTeamsBroadcast", () => ({
  sendTeamsBroadcast: mocks.sendTeamsBroadcast,
}));
vi.mock("@/lib/services/broadcast/sendWhatsappBroadcast", () => ({
  sendWhatsappBroadcast: mocks.sendWhatsappBroadcast,
}));
vi.mock("@/lib/webhooks/leaseHeartbeat", () => ({
  startLeaseHeartbeat: ({ renew }) => ({
    renewNow: async () => {
      const row = await renew();
      if (!row) throw new Error("lease ownership was lost");
    },
    assertOwned: () => {},
    stop: async () => {},
  }),
}));

import { GET as processBroadcastsGet } from "@/app/api/cron/process-scheduled-broadcasts/route.js";

function broadcast(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    organization_id: 7,
    channel: "teams",
    status: "processing",
    claim_token: "00000000-0000-4000-8000-000000000031",
    worker_id: "worker-test",
    payload: { message: "synthetic", userIds: [11] },
    ...overrides,
  };
}

function request() {
  return new Request("http://scheduled-broadcast.invalid/api/cron/process-scheduled-broadcasts", {
    headers: { authorization: "Bearer scheduled-broadcast-test-secret" },
  });
}

describe("Scheduled broadcast lifecycle worker", () => {
  let originalCronSecret;

  beforeEach(() => {
    originalCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "scheduled-broadcast-test-secret";
    vi.clearAllMocks();
    mocks.maintainScheduledBroadcastLifecycle.mockResolvedValue({
      retryable_failed_count: 0,
      failed_count: 0,
      unknown_outcome_count: 0,
    });
    mocks.renewScheduledBroadcastLease.mockImplementation(async (args) => ({
      id: args.id,
      claim_token: args.claimToken,
    }));
    mocks.markScheduledBroadcastSendStarted.mockImplementation(async (args) => ({
      id: args.id,
      claim_token: args.claimToken,
      send_started_at: "2026-07-20T10:00:00.000Z",
    }));
    mocks.completeScheduledBroadcast.mockResolvedValue(broadcast({ status: "sent" }));
    mocks.sendTeamsBroadcast.mockResolvedValue({
      ok: 1,
      failed: 0,
      results: [{ userId: 11, ok: true, status: 202, providerMessageId: "teams-1" }],
    });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("runs maintenance before atomically claiming a batch", async () => {
    mocks.claimDueScheduledBroadcasts.mockResolvedValue([]);
    const response = await processBroadcastsGet(request());
    expect(response.status).toBe(200);
    expect(mocks.maintainScheduledBroadcastLifecycle).toHaveBeenCalledBefore(
      mocks.claimDueScheduledBroadcasts,
    );
    expect(mocks.claimDueScheduledBroadcasts).toHaveBeenCalledWith(
      expect.objectContaining({ leaseSeconds: 120, maxAttempts: 3 }),
    );
  });

  it("marks send started before one sender invocation and persists a compact provider result", async () => {
    mocks.claimDueScheduledBroadcasts.mockResolvedValue([broadcast()]);
    await processBroadcastsGet(request());
    expect(mocks.markScheduledBroadcastSendStarted).toHaveBeenCalledBefore(
      mocks.sendTeamsBroadcast,
    );
    expect(mocks.sendTeamsBroadcast).toHaveBeenCalledTimes(1);
    expect(mocks.completeScheduledBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "sent",
        claimToken: "00000000-0000-4000-8000-000000000031",
        providerResult: {
          ok: 1,
          failed: 0,
          recipients: [{ userId: 11, ok: true, status: 202, providerMessageId: "teams-1" }],
        },
      }),
    );
  });

  it("does not call the sender when mark send started loses ownership", async () => {
    mocks.claimDueScheduledBroadcasts.mockResolvedValue([broadcast()]);
    mocks.markScheduledBroadcastSendStarted.mockResolvedValue(null);
    await processBroadcastsGet(request());
    expect(mocks.sendTeamsBroadcast).not.toHaveBeenCalled();
  });

  it("marks a timeout after send started as unknown_outcome, never retryable_failed", async () => {
    mocks.claimDueScheduledBroadcasts.mockResolvedValue([broadcast()]);
    mocks.sendTeamsBroadcast.mockRejectedValue(new Error("timeout after provider acceptance"));
    await processBroadcastsGet(request());
    expect(mocks.completeScheduledBroadcast).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "unknown_outcome" }),
    );
  });

  it("allows at most one sender invocation when two cron requests race for one row", async () => {
    let claimed = false;
    mocks.claimDueScheduledBroadcasts.mockImplementation(async () => {
      if (claimed) return [];
      claimed = true;
      return [broadcast()];
    });
    await Promise.all([processBroadcastsGet(request()), processBroadcastsGet(request())]);
    expect(mocks.sendTeamsBroadcast).toHaveBeenCalledTimes(1);
  });
});
