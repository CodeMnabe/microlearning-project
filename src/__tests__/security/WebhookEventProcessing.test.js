import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  effects: new Map(),
  transitions: [],
}));

vi.mock("@/lib/repos/webhookEvents.repo", () => ({
  renewWebhookEventLease: vi.fn(async () => ({ id: "event-1" })),
  renewWebhookEffectLease: vi.fn(async () => ({ id: "effect-1" })),
  registerWebhookEffect: vi.fn(async ({ effectType, effectKey, ...input }) => {
    const key = `${input.eventId}:${effectType}:${effectKey}`;
    if (!state.effects.has(key)) {
      state.effects.set(key, {
        id: key,
        status: "pending",
        attempt_count: 0,
      });
    }
    return state.effects.get(key);
  }),
  claimWebhookEffect: vi.fn(async ({ effectId }) => {
    const effect = state.effects.get(effectId);
    if (effect.status === "succeeded") {
      return {
        outcome: "duplicate_succeeded",
        effect_id: effectId,
        result: effect.result,
      };
    }
    if (effect.status === "unknown_outcome") {
      return { outcome: "unknown_outcome", effect_id: effectId };
    }
    if (effect.status === "processing") {
      return { outcome: "duplicate_processing", effect_id: effectId };
    }
    effect.status = "processing";
    effect.attempt_count += 1;
    return {
      outcome: "claimed",
      effect_id: effectId,
      effect_claim_token: "effect-claim",
    };
  }),
  transitionWebhookEffect: vi.fn(
    async ({ effectId, status, result = null }) => {
      const effect = state.effects.get(effectId);
      if (!effect || effect.status !== "processing") return null;
      effect.status = status;
      effect.result = result;
      state.transitions.push({ effectId, status });
      return effect;
    },
  ),
}));

import {
  classifyProviderResult,
  WebhookEffectStateError,
  runWebhookEffect,
} from "@/lib/webhooks/effectRunner";
import {
  buildMessageBirdEventIdentity,
  buildTeamsEventIdentity,
  canonicalJson,
} from "@/lib/webhooks/eventIdentity";

const context = {
  eventId: "event-1",
  organizationId: 7,
  claimToken: "event-claim",
  workerId: "worker-1",
  leaseSeconds: 120,
};

function barrier() {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  return { waiting, release };
}

beforeEach(() => {
  state.effects.clear();
  state.transitions.length = 0;
});

describe("durable webhook effect coordination", () => {
  it.each(["messagebird", "teams"])(
    "executes one external operation for concurrent %s delivery",
    async () => {
      const gate = barrier();
      let calls = 0;
      let markEntered;
      const entered = new Promise((resolve) => {
        markEntered = resolve;
      });
      const first = runWebhookEffect({
        context,
        effectType: "provider_reply",
        effectKey: "reply",
        isExternal: true,
        request: { provider: "synthetic" },
        operation: async () => {
          calls += 1;
          markEntered();
          await gate.waiting;
          return { ok: true, id: "reply-1" };
        },
      });

      await entered;
      const second = runWebhookEffect({
        context,
        effectType: "provider_reply",
        effectKey: "reply",
        isExternal: true,
        request: { provider: "synthetic" },
        operation: async () => {
          calls += 1;
          return { ok: true, id: "reply-2" };
        },
      });

      await expect(second).rejects.toBeInstanceOf(WebhookEffectStateError);
      expect(calls).toBe(1);
      gate.release();
      await expect(first).resolves.toEqual({ ok: true, id: "reply-1" });
      expect(state.transitions).toEqual([
        expect.objectContaining({ status: "succeeded" }),
      ]);
    },
  );

  it("does not automatically re-run an external request with unknown outcome", async () => {
    let calls = 0;
    await expect(
      runWebhookEffect({
        context,
        effectType: "provider_reply",
        effectKey: "timeout",
        isExternal: true,
        operation: async () => {
          calls += 1;
          throw new Error("synthetic timeout after request dispatch");
        },
      }),
    ).rejects.toMatchObject({ webhookState: "unknown_outcome" });

    await expect(
      runWebhookEffect({
        context,
        effectType: "provider_reply",
        effectKey: "timeout",
        isExternal: true,
        operation: async () => {
          calls += 1;
          return { ok: true };
        },
      }),
    ).rejects.toMatchObject({ webhookState: "unknown_outcome" });

    expect(calls).toBe(1);
  });

  it("allows one of eight concurrent workers to execute a claimed effect", async () => {
    const gate = barrier();
    let calls = 0;
    let markEntered;
    const entered = new Promise((resolve) => {
      markEntered = resolve;
    });
    const workers = Array.from({ length: 8 }, () =>
      runWebhookEffect({
        context,
        effectType: "openai_run",
        effectKey: "inbound-1",
        isExternal: true,
        request: { message: "synthetic" },
        operation: async () => {
          calls += 1;
          markEntered();
          await gate.waiting;
          return { ok: true, id: "run-1" };
        },
      }),
    );

    await entered;
    gate.release();
    const outcomes = await Promise.allSettled(workers);
    expect(calls).toBe(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
  });

  it("persists retryable state from reservation coordination", async () => {
    await expect(
      runWebhookEffect({
        context,
        effectType: "event_dispatch",
        effectKey: "reservation-loser",
        isExternal: true,
        operation: async () => {
          throw new WebhookEffectStateError(
            "conversation reservation is busy",
            "retryable_failed",
          );
        },
      }),
    ).rejects.toMatchObject({ webhookState: "retryable_failed" });
    expect(state.transitions).toEqual([
      expect.objectContaining({ status: "retryable_failed" }),
    ]);
  });
});

describe("event identities", () => {
  it("uses canonical payload ordering and tenant-scoped identities", () => {
    expect(canonicalJson({ b: 1, a: { z: 2, y: 3 } })).toBe(
      '{"a":{"y":3,"z":2},"b":1}',
    );

    const teams = {
      type: "message",
      id: "activity-1",
      text: "hello",
      channelData: { tenant: { id: "tenant-a" } },
      conversation: { id: "conversation-a", conversationType: "personal" },
    };
    expect(buildTeamsEventIdentity(teams, 7)).toMatchObject({
      scopeId: "tenant:tenant-a:conversation:conversation-a",
      externalEventId: "activity-1",
    });
    expect(buildTeamsEventIdentity(teams, 8).organizationId).toBe(8);

    const bird = {
      service: "channels",
      event: "whatsapp.inbound",
      payload: {
        id: "message-1",
        channelId: "channel-a",
        body: { type: "text" },
      },
    };
    expect(buildMessageBirdEventIdentity(bird, 7)).toMatchObject({
      scopeId: "channel:channel-a",
      externalEventId: "message-1",
    });
  });

  it("classifies provider rejection and unknown outcomes", () => {
    expect(classifyProviderResult({ ok: false, status: 503 })).toMatchObject({
      status: "retryable_failed",
    });
    expect(
      classifyProviderResult({ ok: false, outcome: "unknown" }),
    ).toMatchObject({
      status: "unknown_outcome",
    });
  });
});
