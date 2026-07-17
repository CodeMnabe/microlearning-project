import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260717150000_atomic_automation_materialization.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("Atomic automation materialization migration contract", () => {
  it("adds a nullable structural origin with FK and one-to-one uniqueness", () => {
    expect(migration).toMatch(/add column automation_run_id uuid null/i);
    expect(migration).toMatch(
      /foreign key \(automation_run_id\)[\s\S]*references public\.automation_run \(id\)[\s\S]*on delete set null/i,
    );
    expect(migration).toMatch(/unique \(automation_run_id\)/i);
    expect(migration).not.toMatch(/automation_run_id uuid not null/i);
  });

  it("keeps multiple manual NULL origins compatible", () => {
    const uniqueNonNullOrigins = new Set();
    const insert = (automationRunId) => {
      if (automationRunId === null) return true;
      if (uniqueNonNullOrigins.has(automationRunId)) return false;
      uniqueNonNullOrigins.add(automationRunId);
      return true;
    };

    expect(insert(null)).toBe(true);
    expect(insert(null)).toBe(true);
    expect(insert("run-R")).toBe(true);
    expect(insert("run-R")).toBe(false);
  });

  it("uses one transaction and locks the run before the only broadcast insert", () => {
    expect(migration.trimStart()).toMatch(/^--[\s\S]*?begin;/i);
    expect(migration.trimEnd()).toMatch(/commit;$/i);

    const lock = migration.indexOf("for update of ar");
    const insert = migration.indexOf("insert into public.scheduled_broadcast");
    const runUpdate = migration.indexOf("update public.automation_run as ar");

    expect(lock).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(lock);
    expect(runUpdate).toBeGreaterThan(insert);
    expect(migration).toMatch(/get diagnostics v_updated_count = row_count/i);
    expect(migration).toMatch(/v_updated_count <> 1/i);
    expect(migration).toMatch(/lost ownership after insert/i);
  });

  it("dual-writes both structural relations and fixes caller-controlled states", () => {
    expect(migration).toMatch(
      /insert into public\.scheduled_broadcast[\s\S]*automation_run_id[\s\S]*'queued'[\s\S]*v_run\.id/i,
    );
    expect(migration).toMatch(
      /update public\.automation_run[\s\S]*status = 'materialized'[\s\S]*scheduled_broadcast_id = v_broadcast\.id/i,
    );
    expect(migration).not.toMatch(/p_status/i);
    expect(migration).toMatch(
      /v_payload := p_payload \|\| pg_catalog\.jsonb_build_object\([\s\S]*'orgId'[\s\S]*v_run\.organization_id[\s\S]*'automationRunId'[\s\S]*v_run\.id/i,
    );
  });

  it("returns explicit non-inserting outcomes for lost or repeated claims", () => {
    for (const outcome of [
      "already_materialized",
      "claim_lost",
      "not_due",
      "not_found",
      "organization_mismatch",
      "materialized",
    ]) {
      expect(migration).toContain(`'${outcome}'::text`);
    }

    const statusCheck = migration.indexOf("v_run.status <> 'queued'");
    const insert = migration.indexOf("insert into public.scheduled_broadcast");
    expect(statusCheck).toBeGreaterThan(-1);
    expect(statusCheck).toBeLessThan(insert);
  });

  it("validates organization, channel, due time, payload, and arguments", () => {
    expect(migration).toMatch(/v_run\.organization_id <> p_organization_id/i);
    expect(migration).toMatch(/v_run\.channel <> p_channel/i);
    expect(migration).toMatch(/v_run\.scheduled_for <> p_scheduled_for/i);
    expect(migration).toMatch(/v_run\.scheduled_for > pg_catalog\.now\(\)/i);
    expect(migration).toMatch(/jsonb_typeof\(p_payload\) <> 'object'/i);
    expect(migration).toMatch(/p_recipient_count < 1/i);
  });

  it("keeps the RPC service-only, SECURITY INVOKER, and search-path restricted", () => {
    expect(migration).toMatch(
      /create or replace function public\.materialize_automation_run/i,
    );
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/set search_path = ''/i);
    expect(migration).toMatch(/current_user <> 'service_role'/i);
    expect(migration).toMatch(
      /from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i,
    );
    expect(migration).toMatch(/aclexplode/i);
    expect(migration).toMatch(/has_function_privilege\('anon'/i);
    expect(migration).toMatch(/has_function_privilege\('authenticated'/i);
    expect(migration).toMatch(/has_function_privilege\('service_role'/i);
  });

  it("contains aggregate-only historical preflight without automatic backfill", () => {
    expect(migration).toMatch(/duplicate payload run-reference groups/i);
    expect(migration).toMatch(/runs pointing to missing broadcasts/i);
    expect(migration).toMatch(/cross-organization run\/broadcast links/i);
    expect(migration).toMatch(/broadcasts referenced by multiple runs/i);
    expect(migration).toMatch(/without a valid same-organization run/i);
    expect(migration).not.toMatch(
      /update\s+public\.scheduled_broadcast\s+set\s+automation_run_id/i,
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+public\.scheduled_broadcast/i,
    );
  });
});
