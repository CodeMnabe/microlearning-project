import { describe, expect, it } from "vitest";
import {
  createImmediateBroadcastRequestHash,
  getIdempotencyKey,
  normalizeImmediateRecipientIds,
  runWithConcurrency,
} from "@/lib/services/broadcast/immediateBroadcast";

describe("Immediate broadcast cost controls", () => {
  it("requires a valid Idempotency-Key", () => {
    expect(() => getIdempotencyKey(new Headers())).toThrow("Idempotency-Key");
    expect(() =>
      getIdempotencyKey(new Headers({ "Idempotency-Key": "short" })),
    ).toThrow("Invalid");
    expect(() =>
      getIdempotencyKey(new Headers({ "Idempotency-Key": "x".repeat(129) })),
    ).toThrow("Invalid");
    expect(() =>
      getIdempotencyKey(
        new Headers({ "Idempotency-Key": "bad key with spaces" }),
      ),
    ).toThrow("Invalid");
    expect(
      getIdempotencyKey(
        new Headers({ "Idempotency-Key": "request-1234567890" }),
      ),
    ).toBe("request-1234567890");
  });

  it("enforces the hard cap before any ownership lookup and deduplicates deterministically", () => {
    expect(
      normalizeImmediateRecipientIds([{ userId: 4 }, { id: 2 }, { userId: 4 }]),
    ).toEqual([4, 2]);
    expect(() => normalizeImmediateRecipientIds([{ userId: 0 }])).toThrow();
    expect(() =>
      normalizeImmediateRecipientIds(
        Array.from({ length: 501 }, (_, id) => ({ userId: id + 1 })),
      ),
    ).toThrow("Too many");
  });

  it("hashes recipient order and object-key order canonically", () => {
    const common = {
      organizationId: 7,
      actorUserId: "actor",
      channel: "whatsapp",
    };
    const first = createImmediateBroadcastRequestHash({
      ...common,
      recipientUserIds: [3, 1],
      payload: { message: "hello", template: { b: 2, a: 1 } },
    });
    const second = createImmediateBroadcastRequestHash({
      ...common,
      recipientUserIds: [1, 3],
      payload: { template: { a: 1, b: 2 }, message: "hello" },
    });
    const changed = createImmediateBroadcastRequestHash({
      ...common,
      recipientUserIds: [1, 3],
      payload: { message: "different" },
    });
    expect(first).toBe(second);
    expect(first).not.toBe(changed);
  });

  it("bounds the local executor and continues after a recipient failure", async () => {
    let active = 0;
    let peak = 0;
    const results = await runWithConcurrency(
      [1, 2, 3, 4, 5, 6],
      2,
      async (id) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        if (id === 3) throw new Error("synthetic failure");
        return { id, ok: true };
      },
    );
    expect(peak).toBeLessThanOrEqual(2);
    expect(results).toHaveLength(6);
    expect(results[2].status).toBe("failed");
    expect(results.filter((result) => result.ok).length).toBe(5);
  });

  it("keeps the new ledger isolated from browser roles in the migration", async () => {
    const migration = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "supabase/migrations/20260720190000_immediate_broadcast_idempotency.sql",
        "utf8",
      ),
    );
    expect(migration).toContain(
      "unique (organization_id, created_by_user_id, channel, idempotency_key)",
    );
    expect(migration).toContain("unique (broadcast_request_id, user_id)");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain(
      "immediate broadcast recipients do not belong to organization",
    );
    expect(migration).toContain("foreign key (user_id, organization_id)");
    expect(migration).toContain("references auth.users(id) on delete restrict");
    expect(migration).toContain("request_claim_token uuid");
    expect(migration).toContain("renew_immediate_broadcast_request_lease");
    expect(migration).toContain("provider result exceeds limit");
    expect(migration).toContain(
      "immediate broadcast delivery ledger invariant failed",
    );
    expect(migration).toContain("PUBLIC has immediate broadcast table access");
    expect(migration).toContain("PUBLIC has immediate broadcast RPC execute");
    expect(migration).toContain("immediate broadcast RLS is disabled");
    expect(migration).toContain("immediate broadcast browser policy exists");
    expect(migration).toContain(
      "PUBLIC has immediate broadcast delivery column access",
    );
    expect(migration).toContain(
      "browser role has immediate broadcast delivery column access",
    );
    expect(migration).toContain("v_terminal<v_request.recipient_count");
    expect(migration).toContain("nullif(btrim(p_provider_message_id),'')");
    expect(migration).toContain(
      "recover_immediate_broadcast_request(p_request_id uuid,p_organization_id integer,p_actor_user_id uuid,p_request_claim_token uuid",
    );
  });

  it("does not recover deliveries before proving the request lease expired", async () => {
    const migration = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "supabase/migrations/20260720190000_immediate_broadcast_idempotency.sql",
        "utf8",
      ),
    );
    const reserve = migration.slice(
      migration.indexOf(
        "create or replace function public.reserve_immediate_broadcast_request",
      ),
      migration.indexOf(
        "create or replace function public.claim_immediate_broadcast_delivery",
      ),
    );
    expect(reserve.indexOf("claim_expires_at is not null")).toBeLessThan(
      reserve.indexOf("The caller owns the request now"),
    );
    expect(reserve).toContain("owner:=false; request_claim_token:=null");
    expect(reserve).toContain("owner:=true; return next");
  });

  it("does not leave an unbounded all-settled fan-out in either immediate sender", async () => {
    const fs = await import("node:fs/promises");
    const [whatsapp, teams] = await Promise.all([
      fs.readFile(
        "src/lib/services/broadcast/sendWhatsappBroadcast.js",
        "utf8",
      ),
      fs.readFile("src/lib/services/broadcast/sendTeamsBroadcast.js", "utf8"),
    ]);
    expect(whatsapp).not.toContain(
      "Promise.allSettled(recipients.map(handleOne))",
    );
    expect(whatsapp).toContain("runWithConcurrency");
    expect(teams).toContain("beforeProviderSend");
  });
});
