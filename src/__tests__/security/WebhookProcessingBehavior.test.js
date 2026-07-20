import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repos/webhookEvents.repo", () => ({
  claimWebhookEvents: vi.fn(async () => []),
  renewWebhookEventLease: vi.fn(async () => null),
  transitionWebhookEvent: vi.fn(async () => null),
}));

vi.mock("@/lib/webhooks/effectRunner", () => ({
  WebhookEffectStateError: class WebhookEffectStateError extends Error {},
}));

import {
  processClaimedWebhookEvent,
  webhookRetryAt,
  webhookStateForError,
} from "@/lib/webhooks/eventWorker";

const messageBirdRoute = readFileSync(
  resolve("src/app/api/messagebird/route.js"),
  "utf8",
);
const teamsRoute = readFileSync(
  resolve("src/app/api/teams/messages/route.js"),
  "utf8",
);
const worker = readFileSync(resolve("src/lib/webhooks/eventWorker.js"), "utf8");

describe("webhook processing behaviour", () => {
  it("uses bounded exponential backoff", () => {
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    expect(webhookRetryAt(1, now)).toBe("2026-07-20T00:00:30.000Z");
    expect(webhookRetryAt(2, now)).toBe("2026-07-20T00:01:00.000Z");
    expect(webhookRetryAt(20, now)).toBe("2026-07-20T01:00:00.000Z");
  });

  it("stops retrying at max attempts", () => {
    expect(webhookStateForError(new Error("retry"), 7, 8)).toBe(
      "retryable_failed",
    );
    expect(webhookStateForError(new Error("retry"), 8, 8)).toBe("failed");
  });

  it("preserves unknown outcomes", () => {
    const error = new Error("unknown");
    error.webhookState = "unknown_outcome";
    expect(webhookStateForError(error, 1, 8)).toBe("unknown_outcome");
  });

  it("returns claim_lost without marking another worker failed", async () => {
    const result = await processClaimedWebhookEvent(
      {
        id: "event-1",
        organization_id: 7,
        provider: "unsupported",
        scope_id: "scope-1",
        claim_token: "old-token",
        attempt_count: 1,
        metadata: { event: {} },
      },
      { workerId: "worker-1", leaseSeconds: 15 },
    );
    expect(result.outcome).toBe("claim_lost");
  });

  it("accepts MessageBird only after durable registration", () => {
    expect(
      messageBirdRoute.indexOf("registerWebhookEvent(identity)"),
    ).toBeLessThan(
      messageBirdRoute.indexOf("return registrationResponse(registration)"),
    );
    expect(messageBirdRoute).not.toMatch(/WEBHOOK_ASYNC_MESSAGEBIRD_ENABLED/);
  });

  it("accepts Teams only after durable registration", () => {
    expect(teamsRoute).toMatch(
      /registrationResponse\(await registerWebhookEvent\(identity\)\)/,
    );
    expect(teamsRoute).not.toMatch(/WEBHOOK_ASYNC_TEAMS_ENABLED/);
  });

  it("treats Bird and Teams provider failures as errors", () => {
    expect(messageBirdRoute).toMatch(
      /throwForProviderResult\(sendRes, "Bird"\)/,
    );
    expect(teamsRoute).toMatch(/Teams rejected reply with status/);
    expect(teamsRoute).toMatch(/Teams reply outcome is unknown/);
  });

  it("coordinates pending outreach and read receipts through claims/effects", () => {
    expect(messageBirdRoute).toMatch(/claimPendingOutreachForWebhook/);
    expect(messageBirdRoute).toMatch(/effectType: "persist_read_receipt"/);
    expect(messageBirdRoute).toMatch(/effectType: "read_chain_processing"/);
  });

  it("starts and cleans event heartbeat in the existing worker", () => {
    expect(worker).toMatch(/startLeaseHeartbeat/);
    expect(worker).toMatch(/heartbeat\.assertOwned\(\)/);
    expect(worker).toMatch(/finally \{[\s\S]*heartbeat\.stop\(\)/);
  });
});
