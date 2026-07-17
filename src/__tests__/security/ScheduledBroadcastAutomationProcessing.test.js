import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDueScheduledBroadcasts: vi.fn(),
  markScheduledBroadcastProcessing: vi.fn(),
  finishScheduledBroadcast: vi.fn(),
  getAutomationRunForScheduledBroadcast: vi.fn(),
  markAutomationRunFailed: vi.fn(),
  markAutomationRunProcessing: vi.fn(),
  markAutomationRunSent: vi.fn(),
  sendTeamsBroadcast: vi.fn(),
  sendWhatsappBroadcast: vi.fn(),
}));

vi.mock("@/lib/repos/scheduledBroadcasts.repo", () => ({
  getDueScheduledBroadcasts: mocks.getDueScheduledBroadcasts,
  markScheduledBroadcastProcessing: mocks.markScheduledBroadcastProcessing,
  finishScheduledBroadcast: mocks.finishScheduledBroadcast,
}));

vi.mock("@/lib/repos/automationRuns.repo", () => ({
  getAutomationRunForScheduledBroadcast:
    mocks.getAutomationRunForScheduledBroadcast,
  markAutomationRunFailed: mocks.markAutomationRunFailed,
  markAutomationRunProcessing: mocks.markAutomationRunProcessing,
  markAutomationRunSent: mocks.markAutomationRunSent,
}));

vi.mock("@/lib/services/broadcast/sendTeamsBroadcast", () => ({
  sendTeamsBroadcast: mocks.sendTeamsBroadcast,
}));

vi.mock("@/lib/services/broadcast/sendWhatsappBroadcast", () => ({
  sendWhatsappBroadcast: mocks.sendWhatsappBroadcast,
}));

import { GET as processBroadcastsGet } from "@/app/api/cron/process-scheduled-broadcasts/route.js";

const runId = "00000000-0000-4000-8000-000000000003";
const broadcastAId = "00000000-0000-4000-8000-000000000030";
const broadcastBId = "00000000-0000-4000-8000-000000000031";

function broadcast({
  id = broadcastAId,
  automationRunId = runId,
  payloadAutomationRunId = runId,
} = {}) {
  return {
    id,
    organization_id: 7,
    channel: "teams",
    status: "queued",
    scheduled_for: "2026-07-17T10:00:00.000Z",
    automation_run_id: automationRunId,
    payload: {
      message: "Scheduled broadcast processing synthetic message",
      userIds: [11],
      ...(payloadAutomationRunId
        ? { automationRunId: payloadAutomationRunId }
        : {}),
    },
  };
}

function request() {
  return new Request(
    "http://scheduled-broadcast-processing.invalid/api/cron/process-scheduled-broadcasts",
    {
      headers: {
        authorization: "Bearer scheduled-broadcast-processing-test-secret",
      },
    },
  );
}

describe("Scheduled broadcast automation processing claims", () => {
  let originalCronSecret;
  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    originalCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "scheduled-broadcast-processing-test-secret";
    vi.clearAllMocks();

    mocks.markScheduledBroadcastProcessing.mockImplementation(
      async (itemId) => ({
        ...broadcast({ id: itemId }),
        status: "processing",
      }),
    );
    mocks.finishScheduledBroadcast.mockImplementation(async (id, patch) => ({
      id,
      ...patch,
    }));
    mocks.getAutomationRunForScheduledBroadcast.mockResolvedValue({
      id: runId,
      organization_id: 7,
      scheduled_broadcast_id: broadcastAId,
      status: "materialized",
    });
    mocks.markAutomationRunProcessing.mockResolvedValue({
      id: runId,
      organization_id: 7,
      scheduled_broadcast_id: broadcastAId,
      status: "processing",
    });
    mocks.markAutomationRunSent.mockResolvedValue({
      id: runId,
      status: "sent",
    });
    mocks.markAutomationRunFailed.mockResolvedValue({
      id: runId,
      status: "failed",
    });
    mocks.sendTeamsBroadcast.mockResolvedValue({
      ok: 1,
      failed: 0,
      results: [{ ok: true }],
    });
    mocks.sendWhatsappBroadcast.mockResolvedValue({
      ok: 1,
      failed: 0,
      results: [{ ok: true }],
    });

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does not call a provider when the automation run claim returns null", async () => {
    mocks.getDueScheduledBroadcasts.mockResolvedValue([broadcast()]);
    mocks.markAutomationRunProcessing.mockResolvedValue(null);

    const response = await processBroadcastsGet(request());
    const body = await response.json();

    expect(body).toMatchObject({ processed: 1, failed: 1 });
    expect(mocks.sendTeamsBroadcast).not.toHaveBeenCalled();
    expect(mocks.sendWhatsappBroadcast).not.toHaveBeenCalled();
    expect(mocks.markAutomationRunFailed).not.toHaveBeenCalled();
    expect(mocks.finishScheduledBroadcast).toHaveBeenCalledWith(broadcastAId, {
      status: "failed",
    });
  });

  it("allows at most one provider call for two broadcasts naming the same run", async () => {
    const linked = broadcast();
    const historicalDuplicate = broadcast({
      id: broadcastBId,
      automationRunId: null,
    });
    mocks.getDueScheduledBroadcasts.mockResolvedValue([
      linked,
      historicalDuplicate,
    ]);
    mocks.getAutomationRunForScheduledBroadcast.mockImplementation(
      async ({ scheduledBroadcastId }) =>
        scheduledBroadcastId === broadcastAId
          ? {
              id: runId,
              organization_id: 7,
              scheduled_broadcast_id: broadcastAId,
              status: "materialized",
            }
          : null,
    );

    const response = await processBroadcastsGet(request());
    const body = await response.json();

    expect(body).toMatchObject({ processed: 2, sent: 1, failed: 1 });
    expect(mocks.sendTeamsBroadcast).toHaveBeenCalledTimes(1);
    expect(mocks.sendWhatsappBroadcast).not.toHaveBeenCalled();
  });

  it("keeps the historical NULL automation_run_id compatibility path", async () => {
    const historical = broadcast({ automationRunId: null });
    mocks.getDueScheduledBroadcasts.mockResolvedValue([historical]);

    const response = await processBroadcastsGet(request());
    const body = await response.json();

    expect(body).toMatchObject({ processed: 1, sent: 1, failed: 0 });
    expect(mocks.getAutomationRunForScheduledBroadcast).toHaveBeenCalledWith({
      id: runId,
      organizationId: 7,
      scheduledBroadcastId: broadcastAId,
    });
    expect(mocks.sendTeamsBroadcast).toHaveBeenCalledTimes(1);
  });

  it("rejects disagreement between structural origin and legacy payload", async () => {
    const mismatched = broadcast({
      payloadAutomationRunId: "00000000-0000-4000-8000-000000000099",
    });
    mocks.getDueScheduledBroadcasts.mockResolvedValue([mismatched]);

    const response = await processBroadcastsGet(request());
    const body = await response.json();

    expect(body).toMatchObject({ processed: 1, failed: 1 });
    expect(mocks.getAutomationRunForScheduledBroadcast).not.toHaveBeenCalled();
    expect(mocks.markAutomationRunProcessing).not.toHaveBeenCalled();
    expect(mocks.sendTeamsBroadcast).not.toHaveBeenCalled();
    expect(mocks.sendWhatsappBroadcast).not.toHaveBeenCalled();
  });
});
