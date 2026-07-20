import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    "supabase/migrations/20260720130000_pending_outreach_active_uniqueness.sql",
  ),
  "utf8",
);
const webhookProcessingMigration = readFileSync(
  resolve("supabase/migrations/20260717190000_webhook_event_processing.sql"),
  "utf8",
);
const route = readFileSync(resolve("src/app/api/messagebird/route.js"), "utf8");
const sender = readFileSync(
  resolve("src/lib/services/broadcast/sendWhatsappBroadcast.js"),
  "utf8",
);
const worker = readFileSync(resolve("src/lib/webhooks/eventWorker.js"), "utf8");

function createBarrier(count) {
  let waiting = 0;
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  return async () => {
    waiting += 1;
    if (waiting === count) release();
    await ready;
  };
}

const activeStates = new Set([
  "reserving",
  "pending",
  "processing",
  "retryable_failed",
  "unknown_outcome",
]);

function fakeStore() {
  const rows = [];
  const metrics = { templates: 0, claims: 0, messages: 0, chains: 0 };
  let nextId = 1;
  return {
    rows,
    metrics,
    reserve({ orgId, userId, token = `token-${nextId}` }) {
      if (
        rows.some(
          (row) =>
            row.orgId === orgId &&
            row.userId === userId &&
            activeStates.has(row.status),
        )
      )
        return null;
      const row = {
        id: nextId++,
        orgId,
        userId,
        status: "reserving",
        claimToken: token,
        leaseValid: true,
        expired: false,
        retryDue: true,
        templateStarted: false,
        sendStarted: false,
        templateMessageId: null,
        replyMessageId: null,
        webhookEventId: null,
      };
      rows.push(row);
      return row;
    },
    complete(row, token, providerId) {
      if (row.status === "pending") {
        if (row.templateMessageId === providerId) return row;
        throw new Error("provider id cannot be overwritten");
      }
      if (
        row.status !== "reserving" ||
        !row.leaseValid ||
        row.claimToken !== token ||
        !providerId
      )
        return null;
      row.status = "pending";
      row.templateMessageId = providerId;
      row.claimToken = null;
      return row;
    },
    fail(row, token) {
      if (
        row.status !== "reserving" ||
        !row.leaseValid ||
        row.claimToken !== token
      )
        return null;
      row.status = row.templateStarted ? "unknown_outcome" : "failed";
      row.claimToken = null;
      return row;
    },
    claim({ orgId, userId, eventId }) {
      const linked = rows.find(
        (candidate) =>
          candidate.orgId === orgId &&
          candidate.userId === userId &&
          candidate.webhookEventId === eventId,
      );
      if (linked) {
        if (
          [
            "replied",
            "failed",
            "expired",
            "unknown_outcome",
            "pending",
            "reserving",
          ].includes(linked.status)
        )
          return null;
        if (linked.status === "processing") {
          if (linked.sendStarted) {
            if (!linked.leaseValid) linked.status = "unknown_outcome";
            return null;
          }
          if (linked.expired) {
            linked.status = "expired";
            linked.claimToken = null;
            return null;
          }
          if (linked.leaseValid) return null;
        }
        if (linked.status === "retryable_failed") {
          if (linked.sendStarted) {
            linked.status = "unknown_outcome";
            return null;
          }
          if (linked.expired) {
            linked.status = "expired";
            linked.claimToken = null;
            return null;
          }
          if (!linked.retryDue) return null;
        }
        linked.status = "processing";
        linked.claimToken = `reply-${linked.id}`;
        linked.leaseValid = true;
        metrics.claims += 1;
        return linked;
      }
      const row = rows.find(
        (candidate) =>
          candidate.orgId === orgId &&
          candidate.userId === userId &&
          candidate.status === "pending" &&
          candidate.templateMessageId &&
          !candidate.webhookEventId,
      );
      if (!row) return null;
      row.status = "processing";
      row.webhookEventId = eventId;
      row.claimToken = `reply-${row.id}`;
      metrics.claims += 1;
      return row;
    },
    transition(row, { token, status, replyMessageId = null }) {
      if (row.status === "replied") {
        if (status === "replied" && row.replyMessageId === replyMessageId)
          return row;
        throw new Error("reply message id cannot be overwritten");
      }
      if (row.status !== "processing" || row.claimToken !== token) return null;
      if (!row.sendStarted) {
        if (status === "replied" || status === "unknown_outcome") {
          throw new Error("reply outcome requires started send");
        }
        row.status = status;
      } else if (status === "replied") {
        if (!String(replyMessageId || "").trim()) {
          throw new Error("reply message id is required");
        }
        row.status = "replied";
        row.replyMessageId = String(replyMessageId).trim();
      } else {
        row.status = "unknown_outcome";
      }
      row.claimToken = null;
      return row;
    },
    maintain(limit) {
      return rows
        .filter(
          (row) =>
            (row.status === "reserving" && row.leaseValid === false) ||
            ((row.status === "pending" ||
              row.status === "retryable_failed" ||
              row.status === "processing") &&
              row.expired &&
              !row.sendStarted) ||
            (row.status === "processing" &&
              row.leaseValid === false &&
              row.sendStarted),
        )
        .sort((a, b) => a.id - b.id)
        .slice(0, limit)
        .map((row) => {
          row.status =
            row.status === "reserving"
              ? row.templateStarted
                ? "unknown_outcome"
                : "failed"
              : row.status === "processing" && row.sendStarted
                ? "unknown_outcome"
                : "expired";
          row.claimToken = null;
          return row;
        });
    },
  };
}

describe("pending outreach template reservation lifecycle", () => {
  it("runs legacy-state and duplicate preflight before replacing the CHECK", () => {
    const waitingPreflight = migration.indexOf(
      "waiting_template_reply rows require manual reconciliation",
    );
    const duplicatePreflight = migration.indexOf(
      "active duplicates require manual reconciliation",
    );
    const defaultChange = migration.indexOf(
      "alter column status set default 'pending'",
    );
    const checkChange = migration.indexOf(
      "add constraint pending_outreach_status_check",
    );
    expect(waitingPreflight).toBeGreaterThan(-1);
    expect(duplicatePreflight).toBeLessThan(defaultChange);
    expect(waitingPreflight).toBeLessThan(checkChange);
    expect(defaultChange).toBeLessThan(checkChange);
  });

  it("runs the earlier webhook migration preflight, default, and CHECK in order", () => {
    const preflight = webhookProcessingMigration.indexOf(
      "historical waiting_template_reply rows require manual reconciliation",
    );
    const defaultChange = webhookProcessingMigration.indexOf(
      "alter column status set default 'pending'",
    );
    const checkReplacement = webhookProcessingMigration.indexOf(
      "drop constraint if exists pending_outreach_status_check",
    );
    expect(preflight).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(defaultChange);
    expect(defaultChange).toBeLessThan(checkReplacement);
  });

  it("normalizes the default and includes reserving in the active unique index", () => {
    expect(migration).toMatch(/alter column status set default 'pending'/i);
    const unique = migration.slice(
      migration.indexOf(
        "create unique index ux_pending_outreach_active_org_user",
      ),
      migration.indexOf(
        ";",
        migration.indexOf(
          "create unique index ux_pending_outreach_active_org_user",
        ),
      ),
    );
    expect(unique).toMatch(
      /\(org_id, user_id\)[\s\S]*'reserving', 'pending', 'processing', 'retryable_failed', 'unknown_outcome'/i,
    );
    expect(unique).not.toMatch(/expires_at\s*>\s*(?:now|pg_catalog\.now)/i);
  });

  it("creates reserving ownership, heartbeat renewal, and template-start proof before Bird", () => {
    expect(sender.indexOf("createPendingOutreach")).toBeLessThan(
      sender.indexOf("r = await sendTemplate"),
    );
    expect(sender).toMatch(/startLeaseHeartbeat/);
    expect(sender).toMatch(/renewPendingOutreachTemplateReservation/);
    expect(
      sender.indexOf("markPendingOutreachTemplateSendStarted"),
    ).toBeLessThan(sender.indexOf("r = await sendTemplate"));
    expect(migration).toMatch(
      /template_send_started_at timestamp with time zone/i,
    );
    expect(migration).toMatch(/worker_id = pg_catalog\.btrim\(p_worker_id\)/i);
  });

  it("does not claim or advance a chain while a template is reserving", () => {
    const store = fakeStore();
    store.reserve({ orgId: 1, userId: 10 });
    expect(
      store.claim({ orgId: 1, userId: 10, eventId: "event-a" }),
    ).toBeNull();
    expect(store.metrics).toMatchObject({ claims: 0, messages: 0, chains: 0 });
    const claim = migration.slice(
      migration.indexOf("function public.claim_pending_outreach_for_reply"),
      migration.indexOf("function public.maintain_pending_outreach"),
    );
    expect(claim).toMatch(/pending_row\.status = 'pending'/);
    expect(claim).not.toMatch(/pending_row\.status = 'reserving'/);
  });

  it("recovers a crash before Bird safely and marks a post-start crash unknown", () => {
    const store = fakeStore();
    const before = store.reserve({ orgId: 1, userId: 10 });
    before.leaseValid = false;
    const after = store.reserve({ orgId: 1, userId: 11 });
    after.templateStarted = true;
    after.leaseValid = false;
    expect(store.maintain(2).map((row) => row.status)).toEqual([
      "failed",
      "unknown_outcome",
    ]);
    expect(store.reserve({ orgId: 1, userId: 10 })).toBeTruthy();
    expect(store.reserve({ orgId: 1, userId: 11 })).toBeNull();
  });

  it("allows exactly one concurrent reservation and template send", async () => {
    const store = fakeStore();
    const barrier = createBarrier(2);
    const create = async () => {
      await barrier();
      const row = store.reserve({ orgId: 1, userId: 10 });
      if (!row) return "pending_outreach_active";
      row.templateStarted = true;
      store.metrics.templates += 1;
      store.complete(row, row.claimToken, "template-1");
      return "sent";
    };
    expect((await Promise.all([create(), create()])).sort()).toEqual([
      "pending_outreach_active",
      "sent",
    ]);
    expect(store.metrics.templates).toBe(1);
  });

  it("keeps organization/user isolation for equal user IDs", () => {
    const store = fakeStore();
    expect(store.reserve({ orgId: 1, userId: 10 })).toBeTruthy();
    expect(store.reserve({ orgId: 2, userId: 10 })).toBeTruthy();
  });

  it("requires a current token and lease to complete or fail a reservation", () => {
    const store = fakeStore();
    const row = store.reserve({ orgId: 1, userId: 10, token: "current" });
    expect(store.complete(row, "old", "template-1")).toBeNull();
    row.leaseValid = false;
    expect(store.complete(row, "current", "template-1")).toBeNull();
    expect(store.fail(row, "current", "failed")).toBeNull();
    expect(migration).toMatch(/pending_row\.claim_token = p_claim_token/i);
    expect(migration).toMatch(
      /pending_row\.claim_expires_at >= pg_catalog\.now\(\)/i,
    );
  });

  it("calculates template failure state in SQL instead of accepting caller input", () => {
    const store = fakeStore();
    const beforeBird = store.reserve({ orgId: 1, userId: 10, token: "before" });
    expect(store.fail(beforeBird, "before")).toMatchObject({
      status: "failed",
    });

    const afterBird = store.reserve({ orgId: 1, userId: 11, token: "after" });
    afterBird.templateStarted = true;
    expect(store.fail(afterBird, "after", "failed")).toMatchObject({
      status: "unknown_outcome",
    });
    expect(store.reserve({ orgId: 1, userId: 11 })).toBeNull();

    const failedRpc = migration.slice(
      migration.indexOf(
        "function public.fail_pending_outreach_template_reservation",
      ),
      migration.indexOf("function public.claim_pending_outreach_for_reply"),
    );
    expect(failedRpc).toMatch(
      /when pending_row\.template_send_started_at is null then 'failed'[\s\S]*else 'unknown_outcome'/i,
    );
    expect(failedRpc).not.toMatch(/p_status/i);
  });

  it("does not let an old token, pending completion, or unknown outcome mutate failure state", () => {
    const store = fakeStore();
    const reserved = store.reserve({ orgId: 1, userId: 10, token: "current" });
    expect(store.fail(reserved, "old")).toBeNull();
    expect(store.complete(reserved, "current", "template-1")).toBe(reserved);
    expect(store.fail(reserved, "current")).toBeNull();

    const unknown = store.reserve({ orgId: 1, userId: 11, token: "unknown" });
    unknown.templateStarted = true;
    expect(store.fail(unknown, "unknown")).toMatchObject({
      status: "unknown_outcome",
    });
    expect(store.fail(unknown, "unknown")).toBeNull();
  });

  it("makes same-provider completion idempotent and rejects a different provider ID", () => {
    const store = fakeStore();
    const row = store.reserve({ orgId: 1, userId: 10, token: "current" });
    expect(store.complete(row, "current", "template-1")).toBe(row);
    expect(store.complete(row, "current", "template-1")).toBe(row);
    expect(() => store.complete(row, "current", "template-2")).toThrow(
      "cannot be overwritten",
    );
    expect(store.fail(row, "current", "failed")).toBeNull();
    expect(migration).toMatch(/template message id cannot be overwritten/i);
  });

  it("requires a confirmed provider ID and pending status for inbound claim", () => {
    const store = fakeStore();
    const row = store.reserve({ orgId: 1, userId: 10 });
    row.status = "pending";
    expect(
      store.claim({ orgId: 1, userId: 10, eventId: "event-a" }),
    ).toBeNull();
    row.templateMessageId = "template-1";
    expect(store.claim({ orgId: 1, userId: 10, eventId: "event-a" })).toBe(row);
    expect(migration).toMatch(
      /pending_row\.status = 'pending'[\s\S]*template_message_id is not null/i,
    );
  });

  it("claims one reply only and scopes its effect to that pending outreach", () => {
    expect(route).toMatch(/claimPendingOutreachForReply/);
    expect(route).toMatch(/effectKey: `pending-outreach:\$\{row\.id\}`/);
    expect(route).not.toMatch(/for \(const row of pendingMessages\)/);
    expect(route).not.toMatch(/getAllPendingOutreachByUser/);
  });

  it("maintains reserving rows in stable bounded batches", () => {
    expect(worker).toMatch(/maintainPendingOutreach\(\{ limit \}\)/);
    expect(migration).toMatch(/pending_row\.status = 'reserving'/);
    expect(migration).toMatch(/limit p_limit/i);
    expect(migration).toMatch(
      /template reservation lease expired before the provider request started/i,
    );
    expect(migration).toMatch(
      /template reservation lease expired after the provider request started/i,
    );
  });

  it("expires retryable and pre-send processing rows without expiring post-send processing", () => {
    const store = fakeStore();
    store.rows.push(
      {
        id: 1,
        orgId: 1,
        userId: 10,
        status: "retryable_failed",
        expired: true,
        sendStarted: false,
      },
      {
        id: 2,
        orgId: 1,
        userId: 11,
        status: "retryable_failed",
        expired: false,
        sendStarted: false,
      },
      {
        id: 3,
        orgId: 1,
        userId: 12,
        status: "processing",
        expired: true,
        sendStarted: false,
      },
      {
        id: 4,
        orgId: 1,
        userId: 13,
        status: "processing",
        expired: true,
        leaseValid: true,
        sendStarted: true,
      },
    );
    expect(store.maintain(10).map((row) => row.status)).toEqual([
      "expired",
      "expired",
    ]);
    expect(store.rows.map((row) => row.status)).toEqual([
      "expired",
      "retryable_failed",
      "expired",
      "processing",
    ]);
    expect(store.reserve({ orgId: 1, userId: 10 })).toBeTruthy();
    expect(migration).toMatch(
      /pending_row\.status = 'retryable_failed'[\s\S]*pending_row\.expires_at <= pg_catalog\.now\(\)[\s\S]*pending_row\.send_started_at is null/i,
    );
    expect(migration).toMatch(
      /pending_row\.status = 'processing'[\s\S]*pending_row\.expires_at <= pg_catalog\.now\(\)[\s\S]*pending_row\.send_started_at is null/i,
    );
  });

  it("allows failed and retryable_failed only before the reply send starts", () => {
    const store = fakeStore();
    const failed = store.reserve({ orgId: 1, userId: 10 });
    failed.status = "pending";
    failed.templateMessageId = "template-1";
    store.claim({ orgId: 1, userId: 10, eventId: "event-failed" });
    expect(
      store.transition(failed, { token: "reply-1", status: "failed" }),
    ).toMatchObject({ status: "failed", sendStarted: false });

    const retryable = store.reserve({ orgId: 1, userId: 11 });
    retryable.status = "pending";
    retryable.templateMessageId = "template-2";
    store.claim({ orgId: 1, userId: 11, eventId: "event-retryable" });
    expect(
      store.transition(retryable, {
        token: "reply-2",
        status: "retryable_failed",
      }),
    ).toMatchObject({ status: "retryable_failed", sendStarted: false });
  });

  it("converts every post-send failure to unknown_outcome and preserves send evidence", () => {
    const store = fakeStore();
    for (const [userId, requested] of [
      [10, "failed"],
      [11, "retryable_failed"],
    ]) {
      const row = store.reserve({ orgId: 1, userId });
      row.status = "pending";
      row.templateMessageId = `template-${userId}`;
      store.claim({ orgId: 1, userId, eventId: `event-${userId}` });
      row.sendStarted = true;
      expect(
        store.transition(row, {
          token: `reply-${row.id}`,
          status: requested,
        }),
      ).toMatchObject({ status: "unknown_outcome", sendStarted: true });
      expect(store.reserve({ orgId: 1, userId })).toBeNull();
      expect(
        store.claim({ orgId: 1, userId, eventId: `retry-${userId}` }),
      ).toBeNull();
    }
  });

  it("rejects invalid replied transitions and preserves idempotent valid replies", () => {
    const store = fakeStore();
    const beforeSend = store.reserve({ orgId: 1, userId: 10 });
    beforeSend.status = "pending";
    beforeSend.templateMessageId = "template-1";
    store.claim({ orgId: 1, userId: 10, eventId: "event-before" });
    expect(() =>
      store.transition(beforeSend, {
        token: "reply-1",
        status: "replied",
        replyMessageId: "reply-1",
      }),
    ).toThrow("reply outcome requires started send");

    const afterSend = store.reserve({ orgId: 1, userId: 11 });
    afterSend.status = "pending";
    afterSend.templateMessageId = "template-2";
    store.claim({ orgId: 1, userId: 11, eventId: "event-after" });
    afterSend.sendStarted = true;
    expect(() =>
      store.transition(afterSend, { token: "reply-2", status: "replied" }),
    ).toThrow("reply message id is required");
    expect(() =>
      store.transition(afterSend, {
        token: "reply-2",
        status: "replied",
        replyMessageId: "   ",
      }),
    ).toThrow("reply message id is required");
    expect(
      store.transition(afterSend, {
        token: "reply-2",
        status: "replied",
        replyMessageId: " provider-reply ",
      }),
    ).toMatchObject({
      status: "replied",
      sendStarted: true,
      replyMessageId: "provider-reply",
    });
    expect(
      store.transition(afterSend, {
        token: "old-token",
        status: "replied",
        replyMessageId: "provider-reply",
      }),
    ).toBe(afterSend);
    expect(() =>
      store.transition(afterSend, {
        token: "old-token",
        status: "replied",
        replyMessageId: "different-reply",
      }),
    ).toThrow("cannot be overwritten");
  });

  it("enforces the reply transition invariant in SQL", () => {
    const transition = migration.slice(
      migration.indexOf(
        "function public.transition_pending_outreach_for_webhook",
      ),
      migration.indexOf(
        "alter table public.pending_outreach enable row level security",
      ),
    );
    expect(transition).toMatch(/reply message id is required/i);
    expect(transition).toMatch(/cannot be replied before its send starts/i);
    expect(transition).toMatch(/unknown outcome requires a started send/i);
    expect(transition).toMatch(/v_effective_status = 'unknown_outcome'/i);
    expect(transition).toMatch(
      /v_effective_status in \('replied', 'unknown_outcome'\)/i,
    );
    expect(transition).toMatch(/reply message id cannot be overwritten/i);
    expect(route).toMatch(
      /effectivePendingStatus =\s*transitioned\?\.status \|\| "unknown_outcome"/,
    );
  });

  it("never lets an event associated with a terminal row claim a later pending outreach", () => {
    for (const terminal of [
      "replied",
      "failed",
      "expired",
      "unknown_outcome",
    ]) {
      const store = fakeStore();
      const original = store.reserve({ orgId: 1, userId: 10 });
      original.status = terminal;
      original.webhookEventId = "event-terminal";
      const later =
        terminal === "unknown_outcome"
          ? {
              id: 99,
              orgId: 1,
              userId: 10,
              status: "pending",
              templateMessageId: "later-template",
              webhookEventId: null,
            }
          : store.reserve({ orgId: 1, userId: 10 });
      if (terminal === "unknown_outcome") store.rows.push(later);
      later.status = "pending";
      later.templateMessageId = "later-template";
      expect(
        store.claim({ orgId: 1, userId: 10, eventId: "event-terminal" }),
      ).toBeNull();
      expect(later.status).toBe("pending");
      expect(store.metrics.claims).toBe(0);
    }
  });

  it("keeps a replied event idempotent after a crash without another send or claim", () => {
    const store = fakeStore();
    const original = store.reserve({ orgId: 1, userId: 10 });
    original.status = "replied";
    original.webhookEventId = "event-replied";
    const later = store.reserve({ orgId: 1, userId: 10 });
    later.status = "pending";
    later.templateMessageId = "later-template";
    expect(
      store.claim({ orgId: 1, userId: 10, eventId: "event-replied" }),
    ).toBeNull();
    expect(store.metrics).toMatchObject({ claims: 0, messages: 0, chains: 0 });
  });

  it("expires pre-send associated claims in the claim RPC and only recovers valid retryable rows", () => {
    const store = fakeStore();
    const processing = store.reserve({ orgId: 1, userId: 10 });
    processing.status = "processing";
    processing.webhookEventId = "event-processing-expired";
    processing.expired = true;
    processing.leaseValid = false;
    expect(
      store.claim({
        orgId: 1,
        userId: 10,
        eventId: "event-processing-expired",
      }),
    ).toBeNull();
    expect(processing.status).toBe("expired");

    const retryExpired = store.reserve({ orgId: 1, userId: 11 });
    retryExpired.status = "retryable_failed";
    retryExpired.webhookEventId = "event-retry-expired";
    retryExpired.expired = true;
    expect(
      store.claim({ orgId: 1, userId: 11, eventId: "event-retry-expired" }),
    ).toBeNull();
    expect(retryExpired.status).toBe("expired");

    const retryValid = store.reserve({ orgId: 1, userId: 12 });
    retryValid.status = "retryable_failed";
    retryValid.webhookEventId = "event-retry-valid";
    retryValid.retryDue = true;
    expect(
      store.claim({ orgId: 1, userId: 12, eventId: "event-retry-valid" }),
    ).toBe(retryValid);
    expect(retryValid.status).toBe("processing");
  });

  it("turns a post-send expired lease into unknown outcome without changing event association", () => {
    const store = fakeStore();
    const row = store.reserve({ orgId: 1, userId: 10 });
    row.status = "processing";
    row.webhookEventId = "event-post-send";
    row.sendStarted = true;
    row.leaseValid = false;
    expect(
      store.claim({ orgId: 1, userId: 10, eventId: "event-post-send" }),
    ).toBeNull();
    expect(row).toMatchObject({
      status: "unknown_outcome",
      webhookEventId: "event-post-send",
      sendStarted: true,
    });
  });

  it("adds permanent event association uniqueness and preserves duplicate evidence in preflight", () => {
    const unique = migration.slice(
      migration.indexOf(
        "create unique index ux_pending_outreach_webhook_event_once",
      ),
      migration.indexOf(
        ";",
        migration.indexOf(
          "create unique index ux_pending_outreach_webhook_event_once",
        ),
      ),
    );
    expect(unique).toMatch(
      /unique index ux_pending_outreach_webhook_event_once[\s\S]*\(webhook_event_id\)[\s\S]*webhook_event_id is not null/i,
    );
    const preflight = migration.indexOf(
      "webhook_event_id duplicates require manual reconciliation",
    );
    expect(preflight).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(
      migration.indexOf(
        "create unique index ux_pending_outreach_webhook_event_once",
      ),
    );
    expect(migration).not.toMatch(/delete from public\.pending_outreach/i);
  });

  it("checks all associated statuses before looking for an unassociated pending row", () => {
    const claim = migration.slice(
      migration.indexOf("function public.claim_pending_outreach_for_reply"),
      migration.indexOf("function public.maintain_pending_outreach"),
    );
    expect(claim).toMatch(
      /pending_row\.webhook_event_id = p_webhook_event_id[\s\S]*for update of pending_row/i,
    );
    expect(claim).toMatch(
      /'replied', 'failed', 'expired', 'unknown_outcome', 'pending', 'reserving'/i,
    );
    expect(claim).toMatch(/v_pending\.expires_at <= pg_catalog\.now\(\)/i);
  });

  it("keeps RPCs service-role-only and removes all browser write privileges", () => {
    for (const name of [
      "reserve_pending_outreach",
      "renew_pending_outreach_template_reservation",
      "mark_pending_outreach_template_send_started",
      "complete_pending_outreach_template_reservation",
      "fail_pending_outreach_template_reservation",
      "claim_pending_outreach_for_reply",
      "maintain_pending_outreach",
    ]) {
      const start = migration.indexOf(`function public.${name}`);
      const body = migration.slice(start, migration.indexOf("$$;", start));
      expect(body).toMatch(/security invoker/i);
      expect(body).toMatch(/set search_path = ''/i);
    }
    expect(migration).toMatch(/delete, truncate, references, trigger/i);
    expect(migration).toMatch(/PUBLIC has pending outreach write privileges/i);
    expect(migration).toMatch(
      /has_table_privilege\(v_role, 'public\.pending_outreach', v_privilege\)/i,
    );
  });

  it("contains no test network setup or real-provider invocation", () => {
    expect(migration).not.toMatch(/http:\/\/|https:\/\//i);
    expect(sender).toMatch(/pending_outreach_active/);
  });
});
