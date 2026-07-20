import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260717190000_webhook_event_processing.sql"),
  "utf8",
);

describe("webhook processing migration", () => {
  it("does not reject or constrain historical thread identities", () => {
    expect(migration).not.toMatch(/duplicate logical threads/i);
    expect(migration).not.toMatch(
      /create unique index\s+thread_(?:user|group)_/i,
    );
    expect(migration).not.toMatch(
      /unique\s*\(\s*user_id\s*,\s*assistant_id\s*,\s*channel/i,
    );
  });

  it("creates a separate reservation with a null-safe functional identity", () => {
    expect(migration).toMatch(/create table public\.conversation_reservation/i);
    expect(migration).toMatch(/actor_key text not null/i);
    expect(migration).toMatch(
      /unique \(organization_id, provider, scope_id, actor_key, assistant_id, channel\)/i,
    );
    expect(migration).toMatch(/when user_id is null then 'group'/i);
  });

  it("links reservations to organization, user, assistant and current thread", () => {
    for (const constraint of [
      "conversation_reservation_organization_id_fkey",
      "conversation_reservation_user_id_fkey",
      "conversation_reservation_assistant_id_fkey",
      "conversation_reservation_current_thread_id_fkey",
    ]) {
      expect(migration).toContain(constraint);
    }
  });

  it("provides atomic reservation lifecycle functions", () => {
    for (const name of [
      "register_conversation_reservation",
      "claim_conversation_reservation",
      "renew_conversation_reservation_lease",
      "mark_conversation_reservation_remote_started",
      "associate_conversation_reservation_thread",
      "transition_conversation_reservation",
    ]) {
      expect(migration).toMatch(
        new RegExp(`create or replace function public\\.${name}\\(`, "i"),
      );
    }
  });

  it("requires valid ownership for all three lease renewals", () => {
    for (const name of [
      "renew_webhook_event_lease",
      "renew_webhook_effect_lease",
      "renew_conversation_reservation_lease",
    ]) {
      const start = migration.indexOf(`function public.${name}`);
      const body = migration.slice(start, migration.indexOf("$$;", start));
      expect(body).toMatch(/status = 'processing'/i);
      expect(body).toMatch(/claim_token = p_(?:effect_)?claim_token/i);
      expect(body).toMatch(/claim_expires_at >= pg_catalog\.now\(\)/i);
      expect(body).toMatch(/p_lease_seconds < 15 or p_lease_seconds > 900/i);
    }
  });

  it("makes an expired remote reservation an unknown outcome", () => {
    expect(migration).toMatch(
      /claim_expires_at < pg_catalog\.now\(\)[\s\S]*remote_started_at is not null[\s\S]*status = 'unknown_outcome'/i,
    );
  });

  it("does not permit retryable release after remote creation started", () => {
    expect(migration).toMatch(
      /p_status <> 'retryable_failed' or reservation_row\.remote_started_at is null/i,
    );
  });

  it("uses security invoker and an empty search path for internal RPCs", () => {
    const functions =
      migration.match(/create or replace function public\.[\s\S]*?\$\$;/gi) ||
      [];
    expect(functions.length).toBeGreaterThanOrEqual(16);
    for (const definition of functions) {
      expect(definition).toMatch(/security invoker/i);
      expect(definition).toMatch(/set search_path = ''/i);
    }
  });

  it("revokes all new-table privileges from browser roles", () => {
    for (const table of [
      "webhook_event",
      "webhook_effect",
      "conversation_reservation",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `revoke all privileges on table public\\.${table} from public, anon, authenticated`,
          "i",
        ),
      );
    }
    for (const privilege of [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ]) {
      expect(migration).toContain(`'${privilege}'`);
    }
  });

  it("validates internal column privileges", () => {
    expect(migration).toMatch(/has_column_privilege/i);
    for (const column of [
      "webhook_event_id",
      "webhook_effect_key",
      "claim_token",
      "claim_expires_at",
      "last_error",
    ]) {
      expect(migration).toContain(`'${column}'`);
    }
  });

  it("enables RLS for every new coordination table", () => {
    for (const table of [
      "webhook_event",
      "webhook_effect",
      "conversation_reservation",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          "i",
        ),
      );
    }
  });

  it("detects payload conflicts under a locked event identity", () => {
    expect(migration).toMatch(/for update of event_row/i);
    expect(migration).toMatch(/v_event\.payload_hash <> p_payload_hash/i);
    expect(migration).toMatch(/'payload_conflict'/i);
  });

  it("keeps provider, organization and scope in event uniqueness", () => {
    expect(migration).toMatch(
      /unique \(\s*provider,\s*organization_id,\s*event_type,\s*scope_id,\s*external_event_id\s*\)/i,
    );
  });

  it("grants RPC execution only to service_role", () => {
    expect(migration).toMatch(/from public, anon, authenticated/gi);
    expect(migration).toMatch(/to service_role/gi);
    expect(migration).toMatch(/aclexplode/i);
    expect(migration).toMatch(/function_acl\.grantee = 0/i);
  });
});
