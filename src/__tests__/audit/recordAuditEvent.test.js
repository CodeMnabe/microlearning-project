import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  insertAuditLog: vi.fn(),
}));

vi.mock("@/lib/repos/auditLog.repo", () => ({
  insertAuditLog: (...args) => mocks.insertAuditLog(...args),
}));

import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";

const orgAuth = {
  orgId: 5,
  org: { id: 5, owner_user_id: "owner-1" },
  user: { id: "22222222-2222-4222-8222-222222222222", email: "owner@x.pt" },
};

describe("recordAuditEvent", () => {
  let consoleError;

  beforeEach(() => {
    mocks.insertAuditLog.mockReset();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("grava a ação com o autor tirado do orgAuth", async () => {
    mocks.insertAuditLog.mockResolvedValue({ id: "row-1" });

    const row = await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.TAG_CREATED,
      entityId: 9,
      entityLabel: "VIP",
    });

    expect(mocks.insertAuditLog).toHaveBeenCalledTimes(1);

    expect(mocks.insertAuditLog).toHaveBeenCalledWith({
      organization_id: 5,
      actor_type: "user",
      actor_user_id: orgAuth.user.id,
      actor_email: "owner@x.pt",
      action: "tag.created",
      entity_type: "tag",
      entity_id: "9",
      entity_label: "VIP",
      details: {},
    });

    expect(row.action).toBe("tag.created");
  });

  it("usa org.id quando orgId não vem no orgAuth", async () => {
    mocks.insertAuditLog.mockResolvedValue({});

    await recordAuditEvent(
      { org: { id: 8 }, user: orgAuth.user },
      { action: AUDIT_ACTIONS.USER_DELETED, entityId: 1 },
    );

    expect(mocks.insertAuditLog.mock.calls[0][0].organization_id).toBe(8);
  });

  it("não lança quando a base de dados falha", async () => {
    mocks.insertAuditLog.mockRejectedValue(new Error("db down"));

    await expect(
      recordAuditEvent(orgAuth, { action: AUDIT_ACTIONS.USER_CREATED }),
    ).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "[Audit] failed to record event",
      expect.objectContaining({
        action: "user.created",
        organizationId: 5,
        message: "db down",
      }),
    );
  });

  it("não lança quando o evento está mal formado", async () => {
    await expect(
      recordAuditEvent(orgAuth, { action: "user.exploded" }),
    ).resolves.toBeNull();

    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });
});
