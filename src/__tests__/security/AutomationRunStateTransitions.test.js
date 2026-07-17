import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => supabaseMock,
}));

import {
  materializeAutomationRun,
  markAutomationRunFailed,
  markAutomationRunProcessing,
  markAutomationRunSent,
} from "@/lib/repos/automationRuns.repo.js";

function fluentUpdateResult(data) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };

  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data, error: null });
  supabaseMock.from.mockReturnValue(query);
  return query;
}

describe("Automation run state transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the atomic RPC and normalizes an explicit claim outcome", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        outcome: "already_materialized",
        run_id: "run-R",
        broadcast_id: "broadcast-B1",
        run_status: "materialized",
        broadcast_status: "queued",
      },
      error: null,
    });
    supabaseMock.rpc.mockReturnValue({ single });

    const result = await materializeAutomationRun({
      id: "run-R",
      organizationId: 7,
      channel: "teams",
      scheduledFor: "2026-07-17T10:00:00.000Z",
      recipientCount: 1,
      payload: { automationRunId: "run-R" },
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "materialize_automation_run",
      {
        p_automation_run_id: "run-R",
        p_organization_id: 7,
        p_channel: "teams",
        p_scheduled_for: "2026-07-17T10:00:00.000Z",
        p_recipient_count: 1,
        p_payload: { automationRunId: "run-R" },
      },
    );
    expect(single).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      outcome: "already_materialized",
      automationRunId: "run-R",
      scheduledBroadcastId: "broadcast-B1",
      runStatus: "materialized",
      broadcastStatus: "queued",
    });
  });

  it("rejects null or unknown RPC results instead of treating them as success", async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { outcome: "unexpected" },
        error: null,
      });
    supabaseMock.rpc.mockReturnValue({ single });

    await expect(
      materializeAutomationRun({
        id: "run-R",
        organizationId: 7,
        channel: "teams",
        scheduledFor: "2026-07-17T10:00:00.000Z",
        recipientCount: 1,
        payload: {},
      }),
    ).rejects.toThrow("Invalid materialize_automation_run response");

    await expect(
      materializeAutomationRun({
        id: "run-R",
        organizationId: 7,
        channel: "teams",
        scheduledFor: "2026-07-17T10:00:00.000Z",
        recipientCount: 1,
        payload: {},
      }),
    ).rejects.toThrow("Invalid materialize_automation_run response");
  });

  it("uses an organization-scoped status CAS for queued failures", async () => {
    const query = fluentUpdateResult(null);

    const result = await markAutomationRunFailed("run-R", "synthetic", {
      organizationId: 7,
      expectedStatuses: ["queued"],
    });

    expect(result).toBeNull();
    expect(query.eq).toHaveBeenCalledWith("id", "run-R");
    expect(query.eq).toHaveBeenCalledWith("organization_id", 7);
    expect(query.in).toHaveBeenCalledWith("status", ["queued"]);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("refuses failure transitions from won or terminal states", async () => {
    for (const unsafeStatus of ["materialized", "sent", "failed"]) {
      await expect(
        markAutomationRunFailed("run-R", "synthetic", {
          organizationId: 7,
          expectedStatuses: [unsafeStatus],
        }),
      ).rejects.toThrow("unsafe source status");
    }

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("claims only materialized runs and completes only processing runs", async () => {
    const processingQuery = fluentUpdateResult(null);
    await markAutomationRunProcessing("run-R", {
      organizationId: 7,
      scheduledBroadcastId: "broadcast-B1",
    });

    expect(processingQuery.eq).toHaveBeenCalledWith("status", "materialized");
    expect(processingQuery.eq).toHaveBeenCalledWith("organization_id", 7);
    expect(processingQuery.eq).toHaveBeenCalledWith(
      "scheduled_broadcast_id",
      "broadcast-B1",
    );

    const sentQuery = fluentUpdateResult(null);
    await markAutomationRunSent("run-R", {
      organizationId: 7,
      scheduledBroadcastId: "broadcast-B1",
    });

    expect(sentQuery.eq).toHaveBeenCalledWith("status", "processing");
    expect(sentQuery.eq).toHaveBeenCalledWith("organization_id", 7);
    expect(sentQuery.eq).toHaveBeenCalledWith(
      "scheduled_broadcast_id",
      "broadcast-B1",
    );
  });
});
