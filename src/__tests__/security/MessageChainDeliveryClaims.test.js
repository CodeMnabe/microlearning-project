import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  deliveries: new Map(),
  providerCalls: 0,
  progressUpdates: 0,
  messageWrites: 0,
  renewCalls: 0,
  nextId: 1,
  providerEntered: null,
  provider: null,
  failMessageWrite: false,
}));

function barrier() {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  return { waiting, release };
}

function deliveryKey({ chainRecipientId, stepIndex }) {
  return `${chainRecipientId}:${stepIndex}`;
}

function reset() {
  state.deliveries.clear();
  state.providerCalls = 0;
  state.progressUpdates = 0;
  state.messageWrites = 0;
  state.renewCalls = 0;
  state.nextId = 1;
  state.providerEntered = null;
  state.failMessageWrite = false;
  state.provider = async () => ({
    results: [{ ok: true, kind: "freeform", providerMessageId: "provider-1" }],
  });
}

vi.mock("@/lib/services/broadcast/sendWhatsappBroadcast", () => ({
  sendWhatsappBroadcast: vi.fn(async (...args) => {
    state.providerCalls += 1;
    state.providerEntered?.release();
    return state.provider(...args);
  }),
}));

vi.mock("@/lib/repos/messages.repo", () => ({
  createMessage: vi.fn(async () => {
    if (state.failMessageWrite)
      throw new Error("synthetic local message persistence failure");
    return { id: (state.messageWrites += 1) };
  }),
}));

vi.mock("@/lib/repos/messageChain.repo", () => ({
  ensureMessageChainDelivery: vi.fn(async (input) => {
    const key = deliveryKey(input);
    if (!state.deliveries.has(key)) {
      state.deliveries.set(key, {
        id: `delivery-${state.nextId++}`,
        key,
        chain_id: input.chainId,
        chain_step_id: input.chainStepId,
        chain_recipient_id: input.chainRecipientId,
        user_id: input.userId,
        step_index: input.stepIndex,
        status: input.initialStatus,
        due_at: input.dueAt || null,
        attempt_count: 0,
        send_started_at: null,
        claim_token: null,
        claim_protocol_started_at: null,
        worker_id: null,
        failed_at: null,
        error: null,
        expired: false,
      });
    }
    return state.deliveries.get(key);
  }),
  claimMessageChainDelivery: vi.fn(async (input) => {
    const delivery = [...state.deliveries.values()].find(
      (row) => row.id === input.deliveryId,
    );
    if (
      !delivery ||
      delivery.chain_id !== input.chainId ||
      delivery.chain_step_id !== input.chainStepId ||
      delivery.chain_recipient_id !== input.chainRecipientId ||
      delivery.user_id !== input.userId ||
      Number(input.organizationId) !== 7
    ) {
      throw new Error("delivery ownership is invalid");
    }
    if (
      ["sent", "read", "skipped", "unknown_outcome"].includes(delivery.status)
    ) {
      return { outcome: "terminal", delivery_status: delivery.status };
    }
    if (
      ["failed", "processing"].includes(delivery.status) &&
      !delivery.claim_protocol_started_at
    ) {
      return { outcome: "legacy_unmanaged", delivery_status: delivery.status };
    }
    if (delivery.status === "processing" && !delivery.expired) {
      return {
        outcome: "duplicate_processing",
        delivery_status: delivery.status,
      };
    }
    if (
      delivery.status === "processing" &&
      delivery.expired &&
      delivery.send_started_at
    ) {
      delivery.status = "unknown_outcome";
      delivery.claim_token = null;
      delivery.worker_id = null;
      return { outcome: "unknown_outcome", delivery_status: delivery.status };
    }
    if (delivery.status === "failed" && delivery.send_started_at) {
      return { outcome: "terminal", delivery_status: delivery.status };
    }
    delivery.status = "processing";
    delivery.expired = false;
    delivery.attempt_count += 1;
    delivery.claim_token = `claim-${delivery.attempt_count}`;
    delivery.claim_protocol_started_at ??= "2026-07-20T10:00:00.000Z";
    delivery.worker_id = input.workerId;
    if (!delivery.send_started_at) {
      delivery.failed_at = null;
      delivery.error = null;
    }
    return {
      outcome: "claimed",
      claim_token: delivery.claim_token,
      delivery_status: delivery.status,
    };
  }),
  renewMessageChainDeliveryLease: vi.fn(async ({ deliveryId, claimToken }) => {
    state.renewCalls += 1;
    const delivery = [...state.deliveries.values()].find(
      (row) => row.id === deliveryId,
    );
    if (
      !delivery ||
      delivery.status !== "processing" ||
      delivery.expired ||
      delivery.claim_token !== claimToken
    )
      return null;
    return delivery;
  }),
  markMessageChainDeliverySendStarted: vi.fn(
    async ({ deliveryId, claimToken }) => {
      const delivery = [...state.deliveries.values()].find(
        (row) => row.id === deliveryId,
      );
      if (
        !delivery ||
        delivery.status !== "processing" ||
        delivery.expired ||
        delivery.claim_token !== claimToken
      )
        return null;
      delivery.send_started_at = "2026-07-20T10:00:00.000Z";
      return delivery;
    },
  ),
  completeMessageChainDeliverySend: vi.fn(
    async ({ deliveryId, claimToken, messageId, providerMessageId }) => {
      const delivery = [...state.deliveries.values()].find(
        (row) => row.id === deliveryId,
      );
      if (
        !delivery ||
        delivery.status !== "processing" ||
        delivery.expired ||
        delivery.claim_token !== claimToken ||
        !messageId
      )
        return null;
      delivery.status = "sent";
      delivery.message_id = messageId;
      delivery.provider_message_id = providerMessageId;
      delivery.claim_token = null;
      delivery.worker_id = null;
      delivery.failed_at = null;
      delivery.error = null;
      state.progressUpdates += 1;
      return delivery;
    },
  ),
  failMessageChainDeliveryBeforeSend: vi.fn(
    async ({ deliveryId, claimToken }) => {
      const delivery = [...state.deliveries.values()].find(
        (row) => row.id === deliveryId,
      );
      if (
        !delivery ||
        delivery.claim_token !== claimToken ||
        delivery.send_started_at
      )
        return null;
      delivery.status = "failed";
      delivery.claim_token = null;
      delivery.worker_id = null;
      delivery.failed_at = "failed-at";
      delivery.error = "failed before send";
      return delivery;
    },
  ),
  failMessageChainDeliveryAfterSend: vi.fn(
    async ({ deliveryId, claimToken, providerMessageId }) => {
      const delivery = [...state.deliveries.values()].find(
        (row) => row.id === deliveryId,
      );
      if (
        !delivery ||
        delivery.claim_token !== claimToken ||
        !delivery.send_started_at
      )
        return null;
      delivery.status = "failed";
      delivery.provider_message_id = providerMessageId;
      delivery.claim_token = null;
      delivery.worker_id = null;
      return delivery;
    },
  ),
  markMessageChainDeliveryUnknownOutcome: vi.fn(
    async ({ deliveryId, claimToken, providerMessageId }) => {
      const delivery = [...state.deliveries.values()].find(
        (row) => row.id === deliveryId,
      );
      if (
        !delivery ||
        delivery.claim_token !== claimToken ||
        !delivery.send_started_at
      )
        return null;
      delivery.status = "unknown_outcome";
      delivery.provider_message_id =
        providerMessageId || delivery.provider_message_id;
      delivery.claim_token = null;
      delivery.worker_id = null;
      return delivery;
    },
  ),
}));

import { sendReadChainStep } from "@/lib/services/broadcast/readChains/sendReadChainStep";

function args(overrides = {}) {
  return {
    chain: {
      id: "chain-1",
      organization_id: 7,
      created_by_user_id: 3,
      status: "active",
    },
    chainRecipient: { id: "recipient-1", user_id: 42, status: "active" },
    chainStep: { id: "step-2", payload: { message: "synthetic" } },
    stepIndex: 2,
    ...overrides,
  };
}

beforeEach(reset);

describe("message chain delivery functional claims", () => {
  it("allows one provider call for two concurrent direct progressions", async () => {
    const gate = barrier();
    state.providerEntered = barrier();
    state.provider = async () => {
      await gate.waiting;
      return {
        results: [
          { ok: true, kind: "freeform", providerMessageId: "provider-1" },
        ],
      };
    };
    const first = sendReadChainStep(args());
    await state.providerEntered.waiting;
    const second = sendReadChainStep(args());
    expect(state.providerCalls).toBe(1);
    gate.release();
    await Promise.all([first, second]);
    expect(state.deliveries.size).toBe(1);
    expect(state.progressUpdates).toBe(1);
  });

  it("collapses two distinct webhook-event callers at the functional delivery", async () => {
    const gate = barrier();
    state.providerEntered = barrier();
    state.provider = async () => {
      await gate.waiting;
      return {
        results: [
          { ok: true, kind: "freeform", providerMessageId: "provider-1" },
        ],
      };
    };
    const one = sendReadChainStep(args({ workerId: "event-a" }));
    await state.providerEntered.waiting;
    const two = sendReadChainStep(args({ workerId: "event-b" }));
    expect(state.providerCalls).toBe(1);
    gate.release();
    await Promise.all([one, two]);
    expect(state.deliveries.size).toBe(1);
  });

  it.each(["processing", "sent", "read", "skipped"])(
    "does not send when delivery is already %s",
    async (status) => {
      const input = args();
      const key = deliveryKey({
        chainRecipientId: input.chainRecipient.id,
        stepIndex: input.stepIndex,
      });
      state.deliveries.set(key, {
        id: "delivery-existing",
        key,
        chain_id: "chain-1",
        chain_step_id: "step-2",
        chain_recipient_id: "recipient-1",
        user_id: 42,
        step_index: 2,
        status,
        attempt_count: 1,
        expired: false,
        send_started_at: status === "processing" ? null : "started",
        claim_token: status === "processing" ? "other" : null,
        claim_protocol_started_at: "protocol-started",
      });
      const result = await sendReadChainStep(input);
      expect(result.sent).toBe(false);
      expect(state.providerCalls).toBe(0);
    },
  );

  it.each(["failed", "processing"])(
    "does not resend a historic unmanaged %s delivery",
    async (status) => {
      const input = args();
      const key = deliveryKey({
        chainRecipientId: input.chainRecipient.id,
        stepIndex: input.stepIndex,
      });
      state.deliveries.set(key, {
        id: `delivery-legacy-${status}`,
        key,
        chain_id: "chain-1",
        chain_step_id: "step-2",
        chain_recipient_id: "recipient-1",
        user_id: 42,
        step_index: 2,
        status,
        attempt_count: 0,
        expired: status === "processing",
        send_started_at: null,
        claim_token: null,
        claim_protocol_started_at: null,
      });

      await expect(sendReadChainStep(input)).resolves.toMatchObject({
        skipped: true,
        kind: "legacy_unmanaged",
      });
      expect(state.providerCalls).toBe(0);
    },
  );

  it("persists the winning worker only while the claim owns the send", async () => {
    const gate = barrier();
    state.providerEntered = barrier();
    state.provider = async () => {
      await gate.waiting;
      return {
        results: [
          { ok: true, kind: "freeform", providerMessageId: "provider-1" },
        ],
      };
    };
    const sending = sendReadChainStep(args({ workerId: "worker-a" }));
    await state.providerEntered.waiting;
    const delivery = [...state.deliveries.values()][0];
    expect(delivery.worker_id).toBe("worker-a");
    gate.release();
    await sending;
    expect(delivery.worker_id).toBeNull();
  });

  it("retries only a protocol-managed pre-send failure and clears failure fields on success", async () => {
    const input = args();
    const key = deliveryKey({
      chainRecipientId: input.chainRecipient.id,
      stepIndex: input.stepIndex,
    });
    state.deliveries.set(key, {
      id: "delivery-retryable",
      key,
      chain_id: "chain-1",
      chain_step_id: "step-2",
      chain_recipient_id: "recipient-1",
      user_id: 42,
      step_index: 2,
      status: "failed",
      attempt_count: 1,
      expired: false,
      send_started_at: null,
      claim_token: null,
      claim_protocol_started_at: "protocol-started",
      failed_at: "failed-at",
      error: "pre-send error",
    });

    await expect(sendReadChainStep(input)).resolves.toMatchObject({
      sent: true,
    });
    const delivery = state.deliveries.get(key);
    expect(state.providerCalls).toBe(1);
    expect(delivery.attempt_count).toBe(2);
    expect(delivery.status).toBe("sent");
    expect(delivery.failed_at).toBeNull();
    expect(delivery.error).toBeNull();
  });

  it("recovers an expired lease only before send_started_at", async () => {
    const input = args();
    const key = deliveryKey({
      chainRecipientId: input.chainRecipient.id,
      stepIndex: input.stepIndex,
    });
    state.deliveries.set(key, {
      id: "delivery-expired",
      key,
      chain_id: "chain-1",
      chain_step_id: "step-2",
      chain_recipient_id: "recipient-1",
      user_id: 42,
      step_index: 2,
      status: "processing",
      attempt_count: 1,
      expired: true,
      send_started_at: null,
      claim_token: "old",
      claim_protocol_started_at: "protocol-started",
    });
    await expect(sendReadChainStep(input)).resolves.toMatchObject({
      sent: true,
    });
    expect(state.providerCalls).toBe(1);
    expect(state.deliveries.get(key).attempt_count).toBe(2);
  });

  it("turns an expired lease after send_started_at into unknown_outcome without a new send", async () => {
    const input = args();
    const key = deliveryKey({
      chainRecipientId: input.chainRecipient.id,
      stepIndex: input.stepIndex,
    });
    state.deliveries.set(key, {
      id: "delivery-unknown",
      key,
      chain_id: "chain-1",
      chain_step_id: "step-2",
      chain_recipient_id: "recipient-1",
      user_id: 42,
      step_index: 2,
      status: "processing",
      attempt_count: 1,
      expired: true,
      send_started_at: "started",
      claim_token: "old",
      claim_protocol_started_at: "protocol-started",
    });
    await expect(sendReadChainStep(input)).resolves.toMatchObject({
      skipped: true,
      kind: "unknown_outcome",
    });
    expect(state.providerCalls).toBe(0);
    expect(state.deliveries.get(key).status).toBe("unknown_outcome");
  });

  it("records unknown_outcome and blocks retry when provider accepts but local message persistence fails", async () => {
    state.failMessageWrite = true;
    const first = await sendReadChainStep(args());
    state.failMessageWrite = false;
    const second = await sendReadChainStep(args());
    expect(first).toMatchObject({
      unknownOutcome: true,
      kind: "unknown_outcome",
    });
    expect(second).toMatchObject({
      skipped: true,
      deliveryStatus: "unknown_outcome",
    });
    expect(state.providerCalls).toBe(1);
    expect(state.progressUpdates).toBe(0);
  });

  it("records unknown_outcome and blocks retry after a provider timeout", async () => {
    state.provider = async () => {
      throw new Error("synthetic timeout after dispatch");
    };
    const first = await sendReadChainStep(args());
    const second = await sendReadChainStep(args());
    expect(first).toMatchObject({ unknownOutcome: true });
    expect(second).toMatchObject({
      skipped: true,
      deliveryStatus: "unknown_outcome",
    });
    expect(state.providerCalls).toBe(1);
  });

  it("does not let an old token renew or complete a delivery", async () => {
    const input = args();
    const key = deliveryKey({
      chainRecipientId: input.chainRecipient.id,
      stepIndex: input.stepIndex,
    });
    state.deliveries.set(key, {
      id: "delivery-token",
      key,
      chain_id: "chain-1",
      chain_step_id: "step-2",
      chain_recipient_id: "recipient-1",
      user_id: 42,
      step_index: 2,
      status: "processing",
      attempt_count: 1,
      expired: false,
      send_started_at: "started",
      claim_token: "new-token",
      claim_protocol_started_at: "protocol-started",
    });
    const repo = await import("@/lib/repos/messageChain.repo");
    await expect(
      repo.renewMessageChainDeliveryLease({
        deliveryId: "delivery-token",
        claimToken: "old-token",
      }),
    ).resolves.toBeNull();
    await expect(
      repo.completeMessageChainDeliverySend({
        deliveryId: "delivery-token",
        claimToken: "old-token",
      }),
    ).resolves.toBeNull();
    expect(state.progressUpdates).toBe(0);
  });

  it("keeps recipients and steps isolated while the same recipient-step identity remains unique", async () => {
    await sendReadChainStep(args());
    await sendReadChainStep(
      args({
        chainRecipient: { id: "recipient-2", user_id: 43 },
        workerId: "other-recipient",
      }),
    );
    await sendReadChainStep(
      args({
        chainStep: { id: "step-3", payload: { message: "three" } },
        stepIndex: 3,
        workerId: "other-step",
      }),
    );
    expect(state.providerCalls).toBe(3);
    expect(state.deliveries.size).toBe(3);
  });

  it("rejects a delivery context from another organization before provider contact", async () => {
    await expect(
      sendReadChainStep(args({ chain: { id: "chain-1", organization_id: 8 } })),
    ).rejects.toThrow("ownership");
    expect(state.providerCalls).toBe(0);
  });
});
