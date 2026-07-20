import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  editScheduledBroadcast: vi.fn(),
  cancelScheduledBroadcast: vi.fn(),
  toBrowserScheduledBroadcast: vi.fn((row) => row),
  requireOrgForScheduledBroadcast: vi.fn(),
  handleApiError: vi.fn(
    (error) =>
      new Response(JSON.stringify({ error: error.message }), { status: 500 }),
  ),
}));

vi.mock("@/lib/repos/scheduledBroadcasts.repo", () => ({
  editScheduledBroadcast: mocks.editScheduledBroadcast,
  cancelScheduledBroadcast: mocks.cancelScheduledBroadcast,
  toBrowserScheduledBroadcast: mocks.toBrowserScheduledBroadcast,
}));
vi.mock("@/lib/auth/guards", () => ({
  cleanPatch: (body, fields) =>
    Object.fromEntries(
      Object.entries(body).filter(([key]) => fields.includes(key)),
    ),
  handleApiError: mocks.handleApiError,
  requireOrgForScheduledBroadcast: mocks.requireOrgForScheduledBroadcast,
}));

import { DELETE, PATCH } from "@/app/api/scheduled-broadcasts/[id]/route.js";

const id = "00000000-0000-4000-8000-000000000030";
const updatedAt = "2026-07-20T10:00:00.000Z";

function context() {
  return {
    broadcastId: id,
    orgId: 7,
    user: { id: "00000000-0000-4000-8000-000000000001" },
    broadcast: {
      id,
      organization_id: 7,
      status: "queued",
      updated_at: updatedAt,
    },
  };
}

function patch(body) {
  return PATCH(
    new Request(`http://scheduled.invalid/api/scheduled-broadcasts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("Scheduled broadcast protected item mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgForScheduledBroadcast.mockResolvedValue(context());
    mocks.editScheduledBroadcast.mockResolvedValue({ id, status: "queued" });
    mocks.cancelScheduledBroadcast.mockResolvedValue({
      id,
      status: "cancelled",
    });
  });

  it("edits a queued broadcast through the tenant-scoped RPC", async () => {
    const response = await patch({
      scheduled_for: "2026-07-21T10:00:00.000Z",
      timezone: "Europe/Lisbon",
      expected_updated_at: updatedAt,
    });
    expect(response.status).toBe(200);
    expect(mocks.editScheduledBroadcast).toHaveBeenCalledWith({
      id,
      organizationId: 7,
      actorUserId: context().user.id,
      scheduledFor: "2026-07-21T10:00:00.000Z",
      timezone: "Europe/Lisbon",
      expectedUpdatedAt: updatedAt,
    });
  });

  it("turns a stale PATCH zero-row result into 409", async () => {
    mocks.editScheduledBroadcast.mockResolvedValue(null);
    const response = await patch({
      scheduled_for: "2026-07-21T10:00:00.000Z",
      expected_updated_at: updatedAt,
    });
    expect(response.status).toBe(409);
  });

  it("requires optimistic-concurrency input and rejects arbitrary status", async () => {
    expect(
      (await patch({ scheduled_for: "2026-07-21T10:00:00.000Z" })).status,
    ).toBe(400);
    expect((await patch({ status: "queued" })).status).toBe(400);
  });

  it("uses the dedicated cancellation RPC, not processing-to-cancelled PATCH", async () => {
    const response = await patch({ status: "cancelled" });
    expect(response.status).toBe(200);
    expect(mocks.cancelScheduledBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        organizationId: 7,
        cancelledByUserId: context().user.id,
      }),
    );
    expect(mocks.editScheduledBroadcast).not.toHaveBeenCalled();
  });

  it.each(["processing", "sent", "unknown_outcome"])(
    "returns 409 when %s cannot be cancelled",
    async (status) => {
      mocks.requireOrgForScheduledBroadcast.mockResolvedValue({
        ...context(),
        broadcast: { ...context().broadcast, status },
      });
      mocks.cancelScheduledBroadcast.mockResolvedValue(null);
      expect((await patch({ status: "cancelled" })).status).toBe(409);
    },
  );

  it("turns DELETE into logical cancellation and rejects zero-row lifecycle states", async () => {
    const request = new Request(
      `http://scheduled.invalid/api/scheduled-broadcasts/${id}`,
      { method: "DELETE" },
    );
    expect(
      (await DELETE(request, { params: Promise.resolve({ id }) })).status,
    ).toBe(200);
    mocks.cancelScheduledBroadcast.mockResolvedValue(null);
    expect(
      (await DELETE(request, { params: Promise.resolve({ id }) })).status,
    ).toBe(409);
  });

  it("returns the ownership guard response without invoking mutation RPCs", async () => {
    mocks.requireOrgForScheduledBroadcast.mockResolvedValue({
      error: new Response(null, { status: 403 }),
    });
    expect((await patch({ status: "cancelled" })).status).toBe(403);
    expect(mocks.cancelScheduledBroadcast).not.toHaveBeenCalled();
  });
});
