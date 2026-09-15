/**
 * O motor de automações regista "automation.triggered" no histórico
 * quando cria um run, e fica calado quando o run já existia.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getActiveAutomationRules: vi.fn(),
  createAutomationRunIfMissing: vi.fn(),
  recordSystemAuditEvent: vi.fn(),
}));

vi.mock("@/lib/repos/user.repo", () => ({
  getUserById: (...args) => mocks.getUserById(...args),
}));

vi.mock("@/lib/repos/automationRules.repo", () => ({
  getActiveAutomationRules: (...args) =>
    mocks.getActiveAutomationRules(...args),
}));

vi.mock("@/lib/repos/automationRuns.repo", () => ({
  createAutomationRunIfMissing: (...args) =>
    mocks.createAutomationRunIfMissing(...args),
}));

vi.mock("@/lib/services/audit/recordAuditEvent", () => ({
  recordSystemAuditEvent: (...args) => mocks.recordSystemAuditEvent(...args),
}));

import { queueAutomationRunForRule } from "@/lib/services/automations/automationEngine";

const rule = {
  id: "rule-1",
  organization_id: 4,
  name: "Boas-vindas",
  trigger_type: "user.created",
  channel: "whatsapp",
  delay_minutes: 10,
  payload: { message: "Olá" },
  whatsapp_template_id: null,
  assistant_id: null,
};

const user = {
  id: 42,
  name: "Ana Silva",
  organization_id: 4,
  assistant_id: null,
  phone_number: "+351912345678",
};

describe("registo de automações disparadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordSystemAuditEvent.mockResolvedValue({});
  });

  it("regista o disparo quando o run é criado", async () => {
    mocks.createAutomationRunIfMissing.mockResolvedValue({ id: "run-1" });

    const run = await queueAutomationRunForRule({
      rule,
      user,
      baseTime: new Date("2026-09-10T10:00:00.000Z"),
    });

    expect(run).toEqual({ id: "run-1" });

    expect(mocks.recordSystemAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordSystemAuditEvent).toHaveBeenCalledWith(4, {
      action: "automation.triggered",
      entityType: "automation_rule",
      entityId: "rule-1",
      entityLabel: "Boas-vindas",
      details: {
        triggerType: "user.created",
        channel: "whatsapp",
        userId: 42,
        userName: "Ana Silva",
        scheduledFor: "2026-09-10T10:10:00.000Z",
      },
    });
  });

  it("não regista quando o run já existia", async () => {
    mocks.createAutomationRunIfMissing.mockResolvedValue(null);

    const run = await queueAutomationRunForRule({ rule, user });

    expect(run).toBeNull();
    expect(mocks.recordSystemAuditEvent).not.toHaveBeenCalled();
  });

  it("não regista quando a regra não se aplica ao colaborador", async () => {
    const teamsRule = { ...rule, channel: "teams" };

    const run = await queueAutomationRunForRule({ rule: teamsRule, user });

    expect(run).toBeNull();
    expect(mocks.createAutomationRunIfMissing).not.toHaveBeenCalled();
    expect(mocks.recordSystemAuditEvent).not.toHaveBeenCalled();
  });
});
