import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SENTINELS = Object.freeze([
  "+351911222333",
  "sensitive-user@example.invalid",
  "super-secret-token-should-not-appear",
  "Bearer secret-jwt-value",
  "session=secret-session-value",
  "PRIVATE_MESSAGE_SENTINEL",
  "https://example.invalid/path?token=secret-link-value",
  "TEMPLATE_SECRET_SENTINEL",
  "PROVIDER_RESPONSE_SECRET_SENTINEL",
]);

const mocks = vi.hoisted(() => ({
  maintainScheduledBroadcastLifecycle: vi.fn(),
  claimDueScheduledBroadcasts: vi.fn(),
  renewScheduledBroadcastLease: vi.fn(),
  markScheduledBroadcastSendStarted: vi.fn(),
  completeScheduledBroadcast: vi.fn(),
  sendTeamsBroadcast: vi.fn(),
  sendWhatsappBroadcast: vi.fn(),
  getDueAutomationRunsGlobally: vi.fn(),
  getAutomationRunForScheduledBroadcast: vi.fn(),
  materializeAutomationRun: vi.fn(),
  markAutomationRunFailed: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/lib/repos/scheduledBroadcasts.repo", () => ({
  maintainScheduledBroadcastLifecycle:
    mocks.maintainScheduledBroadcastLifecycle,
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
vi.mock("@/lib/repos/automationRuns.repo", () => ({
  getDueAutomationRunsGlobally: mocks.getDueAutomationRunsGlobally,
  getAutomationRunForScheduledBroadcast:
    mocks.getAutomationRunForScheduledBroadcast,
  materializeAutomationRun: mocks.materializeAutomationRun,
  markAutomationRunFailed: mocks.markAutomationRunFailed,
}));
vi.mock("@/lib/repos/user.repo", () => ({ getUserById: mocks.getUserById }));
vi.mock("@/lib/webhooks/leaseHeartbeat", () => ({
  startLeaseHeartbeat: ({ renew }) => ({
    renewNow: async () => renew(),
    assertOwned: () => {},
    stop: async () => {},
  }),
}));

import { GET as processScheduledBroadcasts } from "@/app/api/cron/process-scheduled-broadcasts/route";
import { GET as materializeAutomations } from "@/app/api/cron/automations/materialize/route";

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

function request(path) {
  return new Request(`http://worker.invalid${path}`, {
    headers: { authorization: "Bearer worker-secret" },
  });
}

const broadcast = {
  id: "00000000-0000-4000-8000-000000000030",
  organization_id: 7,
  channel: "teams",
  claim_token: "claim-secret-sentinel",
  worker_id: "worker-secret-sentinel",
  payload: {
    message: SENTINELS[5],
    files: [{ url: SENTINELS[6] }],
    trackedLinks: [{ trackedUrl: SENTINELS[6] }],
    userIds: [11],
    recipients: [{ phone: SENTINELS[0], email: SENTINELS[1] }],
  },
};

const automationRun = {
  id: "00000000-0000-4000-8000-000000000003",
  organization_id: 7,
  user_id: 11,
  channel: "whatsapp",
  scheduled_for: "2026-07-22T10:00:00.000Z",
  payload: {
    message: SENTINELS[5],
    url: SENTINELS[6],
    templateParams: SENTINELS[7],
  },
};

describe("scheduled and automation worker logging", () => {
  let capture;
  let originalSecret;

  beforeEach(() => {
    vi.clearAllMocks();
    capture = captureConsole();
    originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "worker-secret";
    mocks.maintainScheduledBroadcastLifecycle.mockResolvedValue({});
    mocks.claimDueScheduledBroadcasts.mockResolvedValue([{ ...broadcast }]);
    mocks.renewScheduledBroadcastLease.mockResolvedValue({ id: broadcast.id });
    mocks.markScheduledBroadcastSendStarted.mockResolvedValue({
      id: broadcast.id,
    });
    mocks.completeScheduledBroadcast.mockResolvedValue({ id: broadcast.id });
    mocks.sendTeamsBroadcast.mockResolvedValue({
      ok: 1,
      failed: 0,
      results: [
        {
          userId: 11,
          ok: true,
          status: 202,
          providerMessageId: SENTINELS[8],
          data: { body: SENTINELS[8] },
        },
      ],
    });
    mocks.getDueAutomationRunsGlobally.mockResolvedValue([{ ...automationRun }]);
    mocks.getUserById.mockResolvedValue({
      id: 11,
      organization_id: 7,
      phone_number: SENTINELS[0],
      email: SENTINELS[1],
    });
    mocks.materializeAutomationRun.mockResolvedValue({
      outcome: "materialized",
      scheduledBroadcastId: "00000000-0000-4000-8000-000000000030",
    });
    mocks.markAutomationRunFailed.mockResolvedValue({ id: automationRun.id });
  });

  afterEach(() => {
    capture.restore();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("logs a safe scheduled-broadcast success summary", async () => {
    const response = await processScheduledBroadcasts(
      request("/api/cron/process-scheduled-broadcasts"),
    );
    expect(response.status).toBe(200);
    expect(capture.lines.join("\n")).toContain("scheduled_broadcast_processed");
    expectNoSentinels(capture.lines);
  });

  it("logs a safe scheduled-broadcast error classification", async () => {
    mocks.sendTeamsBroadcast.mockRejectedValue(new Error(SENTINELS[8]));
    await processScheduledBroadcasts(
      request("/api/cron/process-scheduled-broadcasts"),
    );
    expect(capture.lines.join("\n")).toContain(
      "scheduled_broadcast_delivery_failed",
    );
    expectNoSentinels(capture.lines);
  });

  it("finalizes a scheduled broadcast when provider errors expose malicious getters", async () => {
    const maliciousError = { message: "safe provider failure" };
    for (const property of ["name", "code", "status", "retryable"]) {
      Object.defineProperty(maliciousError, property, {
        get() {
          throw new Error(`${property} getter must not execute`);
        },
      });
    }
    mocks.sendTeamsBroadcast.mockRejectedValue(maliciousError);

    const response = await processScheduledBroadcasts(
      request("/api/cron/process-scheduled-broadcasts"),
    );

    expect(response.status).toBe(200);
    expect(mocks.completeScheduledBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unknown_outcome" }),
    );
  });

  it("logs a safe automation-materialization success", async () => {
    const response = await materializeAutomations(
      request("/api/cron/automations/materialize"),
    );
    expect(response.status).toBe(200);
    expect(capture.lines.join("\n")).toContain(
      "automation_materialization_completed",
    );
    expectNoSentinels(capture.lines);
  });

  it("logs a safe automation-materialization error classification", async () => {
    mocks.materializeAutomationRun.mockRejectedValue(new Error(SENTINELS[5]));
    await materializeAutomations(request("/api/cron/automations/materialize"));
    expect(capture.lines.join("\n")).toContain(
      "automation_materialization_failed",
    );
    expectNoSentinels(capture.lines);
  });
});
