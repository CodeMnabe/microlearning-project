import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260720170000_scheduled_broadcast_lifecycle.sql",
  "utf8",
);
const repo = readFileSync("src/lib/repos/scheduledBroadcasts.repo.js", "utf8");
const route = readFileSync(
  "src/app/api/scheduled-broadcasts/[id]/route.js",
  "utf8",
);
const scheduledPage = readFileSync(
  "src/app/[locale]/(app)/broadcast/scheduled/page.js",
  "utf8",
);

describe("Scheduled broadcast lifecycle database contract", () => {
  it("adds protocol ownership and a durable attempt ledger", () => {
    for (const column of [
      "claim_token",
      "worker_id",
      "claim_expires_at",
      "attempt_count",
      "send_started_at",
      "provider_result",
      "cancelled_at",
    ])
      expect(migration).toContain(`add column if not exists ${column}`);
    expect(migration).toContain(
      "create table if not exists public.scheduled_broadcast_attempt",
    );
    expect(migration).toContain(
      "unique (scheduled_broadcast_id, attempt_number)",
    );
    expect(migration).toContain("scheduled_broadcast_attempt_one_active_idx");
  });

  it("contains every lifecycle state and keeps terminal outcomes non-claimable", () => {
    for (const status of [
      "queued",
      "processing",
      "sent",
      "partial",
      "retryable_failed",
      "unknown_outcome",
      "failed",
      "cancelled",
    ]) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).toMatch(/sb\.status = 'queued'[\s\S]*retryable_failed/);
    expect(migration).not.toMatch(
      /sb\.status = 'sent'[\s\S]{0,150}for update of sb skip locked/,
    );
  });

  it("uses SKIP LOCKED, stable ordering and creates the attempt in the claim RPC", () => {
    expect(migration).toMatch(
      /claim_due_scheduled_broadcasts[\s\S]*for update of sb skip locked/i,
    );
    expect(migration).toContain(
      "order by sb.scheduled_for, sb.created_at, sb.id",
    );
    expect(migration).toMatch(
      /insert into public\.scheduled_broadcast_attempt[\s\S]*v_claimed\.claim_token/i,
    );
    expect(migration).toMatch(
      /scheduled broadcast claim requires exactly one matching active attempt/i,
    );
  });

  it("requires token, tenant, worker and a live lease for renewal and send start", () => {
    expect(migration).toMatch(
      /renew_scheduled_broadcast_lease[\s\S]*sb\.organization_id = p_organization_id[\s\S]*sb\.claim_token = p_claim_token[\s\S]*sb\.worker_id = pg_catalog\.btrim\(p_worker_id\)[\s\S]*claim_expires_at > pg_catalog\.now\(\)/i,
    );
    expect(migration).toMatch(
      /mark_scheduled_broadcast_send_started[\s\S]*attempt\.send_started_at/i,
    );
  });

  it("makes post-send errors unknown_outcome and maintenance never reclaims them", () => {
    expect(migration).toMatch(
      /send_started_at is not null[\s\S]*unknown_outcome/i,
    );
    expect(migration).toMatch(
      /v_current\.send_started_at is not null[\s\S]*v_effective_status := 'unknown_outcome'/i,
    );
    expect(migration).not.toMatch(
      /unknown_outcome[\s\S]{0,140}sb\.status = 'queued'/i,
    );
  });

  it("caps safe pre-send retries and turns the exhausted attempt terminal", () => {
    expect(migration).toMatch(
      /p_outcome = 'retryable_failed'[\s\S]*attempt_count >= p_max_attempts[\s\S]*v_effective_status := 'failed'/i,
    );
  });

  it("coordinates automation runs for retry, terminal, unknown and cancelled outcomes", () => {
    expect(migration).toMatch(/when 'retryable_failed' then 'materialized'/i);
    expect(migration).toMatch(/when 'unknown_outcome' then 'unknown_outcome'/i);
    expect(migration).toMatch(
      /cancel_scheduled_broadcast[\s\S]*set status = 'cancelled'/i,
    );
  });

  it("rolls back lifecycle transitions when the current attempt ledger is missing or inconsistent", () => {
    for (const rpc of [
      "maintain_scheduled_broadcast_lifecycle",
      "mark_scheduled_broadcast_send_started",
      "complete_scheduled_broadcast",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `${rpc}[\\s\\S]*get diagnostics v_attempt_updated = row_count;[\\s\\S]*v_attempt_updated <> 1[\\s\\S]*raise exception`,
          "i",
        ),
      );
    }
    expect(migration).toMatch(
      /attempt\.organization_id = v_row\.organization_id[\s\S]*attempt\.attempt_number = v_(?:row|current)\.attempt_count[\s\S]*attempt\.claim_token = p_claim_token/i,
    );
    expect(migration).toMatch(
      /scheduled broadcast completion requires exactly one active attempt/i,
    );
    expect(migration).toMatch(
      /scheduled broadcast maintenance requires exactly one active attempt/i,
    );
  });

  it("requires exactly one coherent automation run update or rolls the broadcast back", () => {
    expect(migration).toMatch(
      /claim_due_scheduled_broadcasts[\s\S]*v_run_updated <> 1[\s\S]*raise exception/i,
    );
    for (const rpc of [
      "maintain_scheduled_broadcast_lifecycle",
      "complete_scheduled_broadcast",
      "cancel_scheduled_broadcast",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `${rpc}[\\s\\S]*get diagnostics v_run_updated = row_count;[\\s\\S]*v_run_updated <> 1[\\s\\S]*raise exception`,
          "i",
        ),
      );
    }
    expect(migration).toContain(
      "scheduled broadcast completion requires its automation run to be processing",
    );
    expect(migration).toContain(
      "scheduled broadcast cancellation requires its automation run to be materialized or processing",
    );
  });

  it("makes PATCH a tenant and queued-state RPC operation with optimistic concurrency", () => {
    expect(route).toContain("expected_updated_at is required");
    expect(repo).toContain('rpcMaybeSingle("edit_scheduled_broadcast"');
    expect(migration).toMatch(
      /edit_scheduled_broadcast[\s\S]*sb\.organization_id = p_organization_id[\s\S]*org\.owner_user_id = p_actor_user_id[\s\S]*sb\.status = 'queued'[\s\S]*sb\.claim_token is null[\s\S]*sb\.updated_at = p_expected_updated_at/i,
    );
    expect(route).toContain("Status changes are not supported by PATCH");
  });

  it("turns DELETE into the protected cancellation operation", () => {
    expect(route).toContain("cancelScheduledBroadcast");
    expect(route).not.toContain("deleteScheduledBroadcast");
    expect(migration).toMatch(
      /cancel_scheduled_broadcast[\s\S]*sb\.status in \('queued', 'retryable_failed'\)[\s\S]*sb\.claim_token is null[\s\S]*sb\.send_started_at is null/i,
    );
  });

  it("keeps scheduled broadcasts behind the API with RLS on both lifecycle tables", () => {
    expect(migration).toContain(
      "revoke all privileges on table public.scheduled_broadcast_attempt from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.scheduled_broadcast from public, anon, authenticated",
    );
    expect(migration).not.toContain(
      "grant select on table public.scheduled_broadcast to authenticated",
    );
    expect(migration).not.toMatch(
      /grant select \([\s\S]*\) on table public\.scheduled_broadcast to authenticated/i,
    );
    expect(migration).toContain(
      "alter table public.scheduled_broadcast enable row level security",
    );
    expect(migration).toContain(
      "alter table public.scheduled_broadcast_attempt enable row level security",
    );
    expect(migration).toContain(
      "browser role retains scheduled broadcast attempt column privilege",
    );
    expect(migration).toMatch(
      /foreach table_name in array array\['scheduled_broadcast', 'scheduled_broadcast_attempt'\][\s\S]*revoke select/i,
    );
    expect(migration).toContain(
      "browser role retains scheduled broadcast table privilege",
    );
    expect(migration).toContain(
      "browser role retains scheduled broadcast column privilege",
    );
    expect(migration).toContain(
      "scheduled broadcast lifecycle table must have RLS enabled",
    );
    expect(migration).toContain(
      "scheduled broadcast lifecycle tables must not have browser RLS policies",
    );
  });

  it("has no browser-side Data API query and keeps the HTTP projection safe", () => {
    expect(scheduledPage).toContain("/api/scheduled-broadcasts?orgId=");
    expect(scheduledPage).not.toContain('.from("scheduled_broadcast")');
    expect(repo).toContain("BROWSER_SCHEDULED_BROADCAST_COLUMNS");
    expect(repo).toContain(".select(BROWSER_SCHEDULED_BROADCAST_COLUMNS)");
    expect(repo).toContain("toBrowserScheduledBroadcast");
    const browserProjection = repo.match(
      /const BROWSER_SCHEDULED_BROADCAST_COLUMNS = \[([\s\S]*?)\]\.join\(/,
    )?.[1];
    expect(browserProjection).toBeTruthy();
    for (const internalColumn of [
      "claim_token",
      "worker_id",
      "claim_expires_at",
      "attempt_count",
      "send_started_at",
      "provider_result",
      "next_attempt_at",
      "last_error",
      "cancelled_by_user_id",
    ]) {
      expect(browserProjection).not.toContain(internalColumn);
    }
  });

  it("uses catalog ACL validation for PUBLIC and browser roles", () => {
    expect(migration).toMatch(
      /revoke all on function public\.claim_due_scheduled_broadcasts[\s\S]*from public, anon, authenticated/i,
    );
    expect(migration).toContain("pg_catalog.pg_proc as proc");
    expect(migration).toContain("privilege.grantee = 0");
    expect(migration).toContain("privilege.privilege_type = 'EXECUTE'");
    expect(migration).toContain("pg_catalog.pg_class as class");
    expect(migration).toContain(
      "scheduled broadcast internal column is readable by a browser role or PUBLIC",
    );
    expect(migration).not.toContain("has_function_privilege('PUBLIC'");
  });

  it("keeps cancellation attribution referential and does not expose provider outcomes", () => {
    expect(migration).toContain(
      "scheduled_broadcast_cancelled_by_user_id_fkey",
    );
    expect(migration).toMatch(
      /references auth\.users\(id\)[\s\S]*on delete set null/i,
    );
    expect(migration).not.toContain(
      "result = coalesce(p_provider_result, sb.result)",
    );
  });
});
