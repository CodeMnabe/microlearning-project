import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260720110000_message_chain_delivery_claims.sql",
  ),
  "utf8",
);

describe("message chain delivery claims migration", () => {
  it("adds ownership/outcome columns and preserves historical delivery states", () => {
    expect(migration).toMatch(/add column if not exists claim_token uuid/i);
    expect(migration).toMatch(/attempt_count integer not null default 0/i);
    expect(migration).toMatch(/send_started_at timestamp with time zone/i);
    expect(migration).toMatch(
      /claim_protocol_started_at timestamp with time zone/i,
    );
    expect(migration).toMatch(/worker_id text null/i);
    expect(migration).toMatch(/unknown_outcome/i);
    for (const status of [
      "queued",
      "scheduled",
      "processing",
      "sent",
      "read",
      "failed",
      "skipped",
    ]) {
      expect(migration).toContain(`'${status}'`);
    }
  });

  it("uses the existing recipient-step identity and defines all delivery RPCs", () => {
    expect(migration).toMatch(
      /on conflict \(chain_recipient_id, step_index\) do nothing/i,
    );
    for (const name of [
      "ensure_message_chain_delivery",
      "claim_message_chain_delivery",
      "renew_message_chain_delivery_lease",
      "mark_message_chain_delivery_send_started",
      "complete_message_chain_delivery_send",
      "fail_message_chain_delivery_before_send",
      "mark_message_chain_delivery_unknown_outcome",
    ]) {
      expect(migration).toMatch(new RegExp(`function public\\.${name}`, "i"));
    }
  });

  it("makes expired started sends unknown, but permits recovery before external start", () => {
    expect(migration).toMatch(
      /claim_expires_at < pg_catalog\.now\(\)[\s\S]*send_started_at is not null[\s\S]*unknown_outcome/i,
    );
    expect(migration).toMatch(
      /status not in \('queued', 'scheduled', 'failed', 'processing'\)/i,
    );
    expect(migration).toMatch(
      /status = 'failed' and v_delivery\.send_started_at is not null/i,
    );
  });

  it("quarantines unmanaged historical failed and processing rows", () => {
    expect(migration).toMatch(
      /status in \('failed', 'processing'\)[\s\S]*claim_protocol_started_at is null[\s\S]*legacy_unmanaged/i,
    );
    expect(migration).toMatch(
      /claim_protocol_started_at = coalesce\(delivery_row\.claim_protocol_started_at, pg_catalog\.now\(\)\)/i,
    );
    expect(migration).toMatch(/worker_id = pg_catalog\.btrim\(p_worker_id\)/i);
    expect(migration).toMatch(/failed_at = null,[\s\S]*error = null/i);
  });

  it("requires and validates the persisted message before completing a delivery", () => {
    expect(migration).toMatch(/if p_message_id is null then/i);
    expect(migration).toMatch(
      /from public\.message as message_row[\s\S]*message_row\.organization_id = p_organization_id/i,
    );
    for (const column of [
      "user_id",
      "message_chain_id",
      "message_chain_step_id",
      "message_chain_recipient_id",
      "message_chain_step_index",
    ]) {
      expect(migration).toContain(`message_row.${column}`);
    }
    expect(migration).toMatch(
      /v_delivery\.provider_message_id = nullif\(pg_catalog\.btrim\(p_provider_message_id\), ''\)/i,
    );
  });

  it("restricts RPCs and internal columns to service_role", () => {
    expect(migration).toMatch(/security invoker[\s\S]*set search_path = ''/i);
    expect(migration).toMatch(
      /revoke all privileges on function public\.claim_message_chain_delivery/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.claim_message_chain_delivery[\s\S]*to service_role/i,
    );
    expect(migration).toMatch(
      /claim_token, claimed_at, claim_expires_at, attempt_count,[\s\S]*last_error, claim_protocol_started_at, worker_id/i,
    );
    expect(migration).toMatch(
      /has_column_privilege\('anon', 'public\.message_chain_delivery'/i,
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.message_chain_delivery from public/i,
    );
    expect(migration).toMatch(
      /revoke %s \(%s\) on table public\.message_chain_delivery from public/i,
    );
    expect(migration).toMatch(/aclexplode\(/i);
    expect(migration).not.toMatch(/has_column_privilege\('PUBLIC'/i);
    expect(migration).toMatch(
      /provider_message_id[\s\S]*\) on table public\.message_chain_delivery from public, anon, authenticated/i,
    );
  });

  it("makes all delivery protocol writes browser-inaccessible without increasing remaining grants", () => {
    const authoritativeColumns = [
      "chain_id",
      "chain_step_id",
      "chain_recipient_id",
      "user_id",
      "step_index",
      "status",
      "message_id",
      "provider_message_id",
      "sent_at",
      "read_at",
      "failed_at",
      "due_at",
      "error",
      "claim_token",
      "claimed_at",
      "claim_expires_at",
      "attempt_count",
      "send_started_at",
      "last_error",
      "claim_protocol_started_at",
      "worker_id",
    ];

    for (const column of authoritativeColumns) {
      expect(migration).toContain(`'${column}'`);
    }
    expect(migration).toMatch(
      /revoke all privileges on table public\.message_chain_delivery from %I/i,
    );
    expect(migration).toMatch(
      /foreach v_privilege in array array\['INSERT', 'UPDATE'\][\s\S]*has_column_privilege\('anon'[\s\S]*has_column_privilege\('authenticated'/i,
    );
    expect(migration).toMatch(
      /grant select \(%s\) on table public\.message_chain_delivery to %I/i,
    );
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|references)\s*\([^)]*\)\s+on table public\.message_chain_delivery/i,
    );
  });

  it("validates that PUBLIC cannot execute any delivery claim RPC", () => {
    for (const name of [
      "ensure_message_chain_delivery",
      "claim_message_chain_delivery",
      "renew_message_chain_delivery_lease",
      "mark_message_chain_delivery_send_started",
      "complete_message_chain_delivery_send",
      "fail_message_chain_delivery_before_send",
      "fail_message_chain_delivery_after_send",
      "mark_message_chain_delivery_unknown_outcome",
    ]) {
      expect(migration).toMatch(new RegExp(`public\\.${name}`, "i"));
    }
    expect(migration).toMatch(/pg_catalog\.pg_proc as procedure_row/i);
    expect(migration).toMatch(/procedure_row\.proacl/i);
    expect(migration).toMatch(/pg_catalog\.aclexplode\(/i);
    expect(migration).toMatch(/procedure_acl\.grantee = 0/i);
    expect(migration).toMatch(/procedure_acl\.privilege_type = 'EXECUTE'/i);
    expect(migration).not.toMatch(/has_function_privilege\('PUBLIC'/i);
  });
});
