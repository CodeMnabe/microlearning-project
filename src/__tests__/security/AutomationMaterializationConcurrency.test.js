import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDueAutomationRuns: vi.fn(),
  materializeAutomationRun: vi.fn(),
  markAutomationRunFailed: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/lib/repos/automationRuns.repo", () => ({
  getDueAutomationRuns: mocks.getDueAutomationRuns,
  materializeAutomationRun: mocks.materializeAutomationRun,
  markAutomationRunFailed: mocks.markAutomationRunFailed,
}));

vi.mock("@/lib/repos/user.repo", () => ({
  getUserById: mocks.getUserById,
}));

import {
  GET as materializeGet,
  POST as materializePost,
} from "@/app/api/cron/automations/materialize/route.js";

const run = {
  id: "00000000-0000-4000-8000-000000000003",
  rule_id: "00000000-0000-4000-8000-000000000010",
  organization_id: 7,
  user_id: 11,
  channel: "teams",
  scheduled_for: "2026-07-17T10:00:00.000Z",
  status: "queued",
  scheduled_broadcast_id: null,
  payload: { message: "Atomic materialization synthetic message" },
};

function createBarrier(parties) {
  let arrivals = 0;
  let release;
  const opened = new Promise((resolve) => {
    release = resolve;
  });

  return async () => {
    arrivals += 1;
    if (arrivals === parties) release();
    await opened;
  };
}

function request(method = "GET") {
  return new Request("http://automation-materialization.invalid/api/cron/automations/materialize", {
    method,
    headers: {
      authorization: "Bearer automation-materialization-test-secret",
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify({ limit: 1 }) } : {}),
  });
}

function installAtomicRpcFake(workerCount) {
  const barrier = createBarrier(workerCount);
  const state = {
    runStatus: "queued",
    runBroadcastId: null,
    broadcasts: [],
  };

  mocks.materializeAutomationRun.mockImplementation(async ({ id }) => {
    await barrier();

    if (state.runStatus !== "queued") {
      return {
        outcome: "already_materialized",
        automationRunId: id,
        scheduledBroadcastId: state.runBroadcastId,
        runStatus: state.runStatus,
        broadcastStatus: "queued",
      };
    }

    const broadcastId = "00000000-0000-4000-8000-000000000030";
    state.broadcasts.push({
      id: broadcastId,
      automation_run_id: id,
      status: "queued",
    });
    state.runStatus = "materialized";
    state.runBroadcastId = broadcastId;

    return {
      outcome: "materialized",
      automationRunId: id,
      scheduledBroadcastId: broadcastId,
      runStatus: "materialized",
      broadcastStatus: "queued",
    };
  });

  return state;
}

describe("Atomic automation materialization route", () => {
  let originalCronSecret;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    originalCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "automation-materialization-test-secret";
    vi.clearAllMocks();
    mocks.getDueAutomationRuns.mockResolvedValue([{ ...run }]);
    mocks.getUserById.mockResolvedValue({
      id: run.user_id,
      organization_id: run.organization_id,
    });
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("lets exactly one of two workers materialize one broadcast", async () => {
    const state = installAtomicRpcFake(2);

    const responses = await Promise.all([
      materializeGet(request()),
      materializeGet(request()),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );

    expect(state.broadcasts).toHaveLength(1);
    expect(state.runStatus).toBe("materialized");
    expect(state.runBroadcastId).toBe(state.broadcasts[0].id);
    expect(state.broadcasts[0].automation_run_id).toBe(run.id);
    expect(bodies.reduce((sum, body) => sum + body.materialized, 0)).toBe(1);
    expect(bodies.reduce((sum, body) => sum + body.skipped, 0)).toBe(1);
    expect(bodies.reduce((sum, body) => sum + body.failed, 0)).toBe(0);
    expect(mocks.markAutomationRunFailed).not.toHaveBeenCalled();
  });

  it("lets exactly one of N concurrent workers materialize", async () => {
    const workerCount = 8;
    const state = installAtomicRpcFake(workerCount);

    const responses = await Promise.all(
      Array.from({ length: workerCount }, () => materializeGet(request())),
    );
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );

    expect(state.broadcasts).toHaveLength(1);
    expect(bodies.reduce((sum, body) => sum + body.materialized, 0)).toBe(1);
    expect(bodies.reduce((sum, body) => sum + body.skipped, 0)).toBe(
      workerCount - 1,
    );
  });

  it("counts a nullable failure compare-and-set as claim_lost, never materialized", async () => {
    mocks.getUserById.mockResolvedValue(null);
    mocks.markAutomationRunFailed.mockResolvedValue(null);

    const response = await materializeGet(request());
    const body = await response.json();

    expect(body).toMatchObject({
      materialized: 0,
      skipped: 1,
      claimLost: 1,
      failed: 0,
    });
    expect(mocks.materializeAutomationRun).not.toHaveBeenCalled();
    expect(mocks.markAutomationRunFailed).toHaveBeenCalledWith(
      run.id,
      expect.any(String),
      {
        organizationId: run.organization_id,
        expectedStatuses: ["queued"],
      },
    );
  });

  it("reports an RPC rollback error without any route-level broadcast insert", async () => {
    mocks.materializeAutomationRun.mockRejectedValue(
      new Error("synthetic transaction rollback"),
    );
    mocks.markAutomationRunFailed.mockResolvedValue({
      ...run,
      status: "failed",
    });

    const response = await materializeGet(request());
    const body = await response.json();

    expect(body).toMatchObject({
      materialized: 0,
      skipped: 0,
      failed: 1,
    });
    expect(body.results[0].error).toBe("synthetic transaction rollback");
    expect(mocks.markAutomationRunFailed).toHaveBeenCalledWith(
      run.id,
      "synthetic transaction rollback",
      expect.objectContaining({ expectedStatuses: ["queued"] }),
    );
  });

  it("treats a known retry as already_materialized and returns the existing broadcast", async () => {
    mocks.materializeAutomationRun.mockResolvedValue({
      outcome: "already_materialized",
      automationRunId: run.id,
      scheduledBroadcastId: "00000000-0000-4000-8000-000000000030",
      runStatus: "materialized",
      broadcastStatus: "queued",
    });

    const response = await materializePost(request("POST"));
    const body = await response.json();

    expect(body).toMatchObject({
      materialized: 0,
      skipped: 1,
      failed: 0,
    });
    expect(body.results[0]).toMatchObject({
      outcome: "already_materialized",
      scheduledBroadcastId: "00000000-0000-4000-8000-000000000030",
    });
    expect(mocks.markAutomationRunFailed).not.toHaveBeenCalled();
  });
});
