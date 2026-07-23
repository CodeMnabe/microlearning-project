import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as manualInactivityPOST } from "@/app/api/automations/manual-inactivity/route";
import { POST as manualMaterializePOST } from "@/app/api/automations/manual-materialize/route";
import * as guards from "@/lib/auth/guards";
import * as inactivityService from "@/lib/services/automations/processInactivityRules";
import * as materializeService from "@/lib/services/automations/materializeDueAutomations";

vi.mock("@/lib/auth/guards", () => ({
  requireOwnedOrg: vi.fn(),
}));

vi.mock("@/lib/services/automations/processInactivityRules", () => ({
  processInactivityRulesForOrganization: vi.fn(),
}));

vi.mock("@/lib/services/automations/materializeDueAutomations", () => ({
  materializeDueAutomationsForOrganization: vi.fn(),
}));

function createRequest(body, headers = {}) {
  const isString = typeof body === "string";
  return {
    method: "POST",
    headers: {
      get: (k) => headers[k.toLowerCase()] ?? "application/json",
    },
    text: async () => isString ? body : JSON.stringify(body),
  };
}

describe("Manual Automation Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guards.requireOwnedOrg.mockResolvedValue({
      ok: true,
      user: { id: "uuid-1" },
      admin: {
        rpc: vi.fn().mockResolvedValue({ data: { accepted: true, retry_after_seconds: 0 } }),
      },
    });
    inactivityService.processInactivityRulesForOrganization.mockResolvedValue({ processedGroups: 1 });
    materializeService.materializeDueAutomationsForOrganization.mockResolvedValue({ processed: 1 });
  });

  describe("Schema Validation", () => {
    it("rejects non-json content-type", async () => {
      const req = createRequest({ organizationId: 123 }, { "content-type": "text/plain" });
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Content-Type/i);
    });

    it("rejects missing body", async () => {
      const req = createRequest("", { "content-type": "application/json" });
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(400);
    });

    it("rejects extra fields", async () => {
      const req = createRequest({ organizationId: 123, global: true });
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/exactly one property/i);
    });

    it("rejects arrays", async () => {
      const req = createRequest([{ organizationId: 123 }]);
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/simple JSON object/i);
    });

    it("rejects strings or non-integers for organizationId", async () => {
      const req = createRequest({ organizationId: "123" });
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/positive integer/i);
    });
  });

  describe("Tenant Isolation & Authorization", () => {
    it("calls requireOwnedOrg and returns 403 if unowned", async () => {
      guards.requireOwnedOrg.mockResolvedValue({ error: new Response("Forbidden", { status: 403 }) });
      const req = createRequest({ organizationId: 888 });
      const res = await manualMaterializePOST(req);
      expect(res.status).toBe(403);
      expect(materializeService.materializeDueAutomationsForOrganization).not.toHaveBeenCalled();
    });

    it("delegates securely for organization only", async () => {
      const req = createRequest({ organizationId: 888 });
      const res = await manualMaterializePOST(req);
      expect(res.status).toBe(200);
      expect(materializeService.materializeDueAutomationsForOrganization).toHaveBeenCalledWith({ organizationId: 888, limit: 200 });
    });
  });

  describe("Layered Rate Limits & Scopes", () => {
    it("short-circuits on org limit (doesn't call actor, action, or service) and sets Retry-After", async () => {
      const rpcMock = vi.fn().mockImplementation((fn, args) => {
        if (args.p_scope.includes("-org")) return Promise.resolve({ data: { accepted: false, retry_after_seconds: 60 } });
        return Promise.resolve({ data: { accepted: true, retry_after_seconds: 0 } });
      });
      guards.requireOwnedOrg.mockResolvedValue({
        ok: true,
        user: { id: "uuid-1" },
        admin: { rpc: rpcMock },
      });
      const req = createRequest({ organizationId: 888 });
      const res = await manualMaterializePOST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("60");
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock.mock.calls[0][1].p_scope).toBe("manual-materialize-org");
      expect(materializeService.materializeDueAutomationsForOrganization).not.toHaveBeenCalled();
    });

    it("short-circuits on actor limit (doesn't call action or service)", async () => {
      const rpcMock = vi.fn().mockImplementation((fn, args) => {
        if (args.p_scope.includes("-actor")) return Promise.resolve({ data: { accepted: false, retry_after_seconds: 30 } });
        return Promise.resolve({ data: { accepted: true, retry_after_seconds: 0 } });
      });
      guards.requireOwnedOrg.mockResolvedValue({
        ok: true,
        user: { id: "uuid-1" },
        admin: { rpc: rpcMock },
      });
      const req = createRequest({ organizationId: 888 });
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("30");
      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(rpcMock.mock.calls[0][1].p_scope).toBe("manual-inactivity-org");
      expect(rpcMock.mock.calls[1][1].p_scope).toBe("manual-inactivity-actor");
      expect(inactivityService.processInactivityRulesForOrganization).not.toHaveBeenCalled();
    });

    it("short-circuits on action limit (doesn't call service)", async () => {
      const rpcMock = vi.fn().mockImplementation((fn, args) => {
        if (args.p_scope.includes("-action")) return Promise.resolve({ data: { accepted: false, retry_after_seconds: 15 } });
        return Promise.resolve({ data: { accepted: true, retry_after_seconds: 0 } });
      });
      guards.requireOwnedOrg.mockResolvedValue({
        ok: true,
        user: { id: "uuid-1" },
        admin: { rpc: rpcMock },
      });
      const req = createRequest({ organizationId: 888 });
      const res = await manualMaterializePOST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("15");
      expect(rpcMock).toHaveBeenCalledTimes(3);
      expect(rpcMock.mock.calls[0][1].p_scope).toBe("manual-materialize-org");
      expect(rpcMock.mock.calls[1][1].p_scope).toBe("manual-materialize-actor");
      expect(rpcMock.mock.calls[2][1].p_scope).toBe("manual-materialize-action");
      expect(materializeService.materializeDueAutomationsForOrganization).not.toHaveBeenCalled();
    });

    it("passes all limits and succeeds with specific inactivity scopes", async () => {
      const rpcMock = vi.fn().mockResolvedValue({ data: { accepted: true, retry_after_seconds: 0 } });
      guards.requireOwnedOrg.mockResolvedValue({
        ok: true,
        user: { id: "uuid-1" },
        admin: { rpc: rpcMock },
      });
      const req = createRequest({ organizationId: 888 });
      const res = await manualInactivityPOST(req);
      expect(res.status).toBe(200);
      expect(rpcMock).toHaveBeenCalledTimes(3);
      expect(rpcMock.mock.calls[0][1].p_scope).toBe("manual-inactivity-org");
      expect(rpcMock.mock.calls[1][1].p_scope).toBe("manual-inactivity-actor");
      expect(rpcMock.mock.calls[2][1].p_scope).toBe("manual-inactivity-action");
      expect(inactivityService.processInactivityRulesForOrganization).toHaveBeenCalledTimes(1);
    });
  });
});
