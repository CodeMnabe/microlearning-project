import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => ({
  reservation: null,
  claimSequence: 0,
  threads: new Map(),
  remoteCalls: 0,
  localCalls: 0,
}));

vi.mock("@/lib/repos/conversationReservations.repo", () => ({
  registerConversationReservation: vi.fn(async (input) => {
    if (!memory.reservation) {
      memory.reservation = {
        id: "reservation-1",
        status: "ready",
        current_thread_id: input.existingThreadId,
      };
    }
    return { ...memory.reservation };
  }),
  claimConversationReservation: vi.fn(async () => {
    const row = memory.reservation;
    if (row.status === "unknown_outcome") {
      return { outcome: "unknown_outcome", reservation_id: row.id };
    }
    if (row.current_thread_id) {
      return {
        outcome: "ready",
        reservation_id: row.id,
        current_thread_id: row.current_thread_id,
      };
    }
    if (row.status === "processing") {
      return { outcome: "duplicate_processing", reservation_id: row.id };
    }
    row.status = "processing";
    memory.claimSequence += 1;
    row.claim_token = `claim-${memory.claimSequence}`;
    return {
      outcome: "claimed",
      reservation_id: row.id,
      reservation_claim_token: row.claim_token,
    };
  }),
  renewConversationReservationLease: vi.fn(async ({ claimToken }) =>
    claimToken === memory.reservation?.claim_token
      ? { ...memory.reservation }
      : null,
  ),
  markConversationReservationRemoteStarted: vi.fn(async ({ claimToken }) => {
    if (claimToken !== memory.reservation?.claim_token) return null;
    memory.reservation.remote_started = true;
    return { ...memory.reservation };
  }),
  associateConversationReservationThread: vi.fn(
    async ({ claimToken, threadId }) => {
      if (claimToken !== memory.reservation?.claim_token) return null;
      memory.reservation.current_thread_id = threadId;
      return { ...memory.reservation };
    },
  ),
  transitionConversationReservation: vi.fn(async ({ claimToken, status }) => {
    if (claimToken !== memory.reservation?.claim_token) return null;
    memory.reservation.status = status;
    memory.reservation.claim_token = null;
    return { ...memory.reservation };
  }),
}));

vi.mock("@/lib/repos/threads.repo", () => ({
  getThreadById: vi.fn(async (id) => memory.threads.get(id) || null),
}));

vi.mock("@/lib/webhooks/effectRunner", () => ({
  WebhookEffectStateError: class WebhookEffectStateError extends Error {
    constructor(message, webhookState) {
      super(message);
      this.webhookState = webhookState;
    }
  },
}));

import { getOrCreateReservedThread } from "@/lib/webhooks/conversationReservation";

const context = {
  eventId: "event-1",
  organizationId: 7,
  provider: "teams",
  scopeId: "tenant:t1:conversation:c1",
  leaseSeconds: 120,
};

function barrier() {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  return { waiting, release };
}

function operation(overrides = {}) {
  return {
    context,
    userId: 11,
    assistantId: 13,
    channel: "teams",
    existingThread: null,
    createRemoteThread: async () => {
      memory.remoteCalls += 1;
      return { id: `remote-${memory.remoteCalls}` };
    },
    createLocalThread: async (remote) => {
      memory.localCalls += 1;
      const thread = { id: memory.localCalls, ai_thread_id: remote.id };
      memory.threads.set(thread.id, thread);
      return thread;
    },
    ...overrides,
  };
}

beforeEach(() => {
  memory.reservation = null;
  memory.claimSequence = 0;
  memory.threads.clear();
  memory.remoteCalls = 0;
  memory.localCalls = 0;
});

describe("conversation reservation coordination", () => {
  it("creates one remote and one local thread for concurrent requests", async () => {
    const gate = barrier();
    let entered;
    const remoteEntered = new Promise((resolve) => {
      entered = resolve;
    });
    const first = getOrCreateReservedThread(
      operation({
        createRemoteThread: async () => {
          memory.remoteCalls += 1;
          entered();
          await gate.waiting;
          return { id: "remote-1" };
        },
      }),
    );
    await remoteEntered;

    await expect(getOrCreateReservedThread(operation())).rejects.toMatchObject({
      webhookState: "retryable_failed",
    });
    expect(memory.remoteCalls).toBe(1);
    expect(memory.localCalls).toBe(0);

    gate.release();
    const winner = await first;
    expect(winner.id).toBe(1);
    expect(memory.remoteCalls).toBe(1);
    expect(memory.localCalls).toBe(1);

    const reused = await getOrCreateReservedThread(operation());
    expect(reused.id).toBe(winner.id);
    expect(memory.remoteCalls).toBe(1);
    expect(memory.localCalls).toBe(1);
  });

  it("uses the most recent historical thread to initialise a reservation", async () => {
    const historical = { id: 5, ai_thread_id: "historical-5" };
    memory.threads.set(5, historical);
    const result = await getOrCreateReservedThread(
      operation({ existingThread: historical }),
    );
    expect(result).toEqual(historical);
    expect(memory.remoteCalls).toBe(0);
    expect(memory.localCalls).toBe(0);
  });

  it("records unknown outcome and never creates a second remote thread", async () => {
    await expect(
      getOrCreateReservedThread(
        operation({
          createRemoteThread: async () => {
            memory.remoteCalls += 1;
            throw new Error("synthetic response loss");
          },
        }),
      ),
    ).rejects.toMatchObject({ webhookState: "unknown_outcome" });
    expect(memory.reservation.status).toBe("unknown_outcome");

    await expect(getOrCreateReservedThread(operation())).rejects.toMatchObject({
      webhookState: "unknown_outcome",
    });
    expect(memory.remoteCalls).toBe(1);
  });

  it("does not call OpenAI after losing the reservation claim", async () => {
    memory.reservation = {
      id: "reservation-1",
      status: "processing",
      current_thread_id: null,
    };
    await expect(getOrCreateReservedThread(operation())).rejects.toMatchObject({
      webhookState: "retryable_failed",
    });
    expect(memory.remoteCalls).toBe(0);
    expect(memory.localCalls).toBe(0);
  });
});
