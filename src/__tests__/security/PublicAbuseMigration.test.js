import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260722180000_public_request_abuse_controls.sql", "utf8");

describe("Public request abuse-control migration", () => {
  it("defines atomic buckets, dedupe and lifecycle storage", () => {
    expect(sql).toMatch(/request_capacity_bucket[\s\S]+PRIMARY KEY \(scope, subject_hash, window_started_at\)/i);
    expect(sql).toMatch(/contact_submission_dedupe[\s\S]+PRIMARY KEY \(fingerprint, window_started_at\)/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS expires_at/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS revoked_at/i);
    expect(sql).toMatch(/tracked_link_event_dedupe_unique/i);
  });

  it("uses invoker RPCs with empty search paths and hard limits", () => {
    expect(sql.match(/SECURITY INVOKER/g)).toHaveLength(4);
    expect(sql.match(/SET search_path = ''/g)).toHaveLength(4);
    expect(sql).toMatch(/p_window_seconds NOT BETWEEN 1 AND 86400/i);
    expect(sql).toMatch(/p_maximum_requests NOT BETWEEN 1 AND 10000/i);
    expect(sql).toMatch(/p_batch_size NOT BETWEEN 1 AND 1000/i);
  });

  it("denies browser roles and grants only service execution", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.consume_request_capacity[\s\S]+FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.consume_request_capacity[\s\S]+TO service_role/i);
    expect(sql).toMatch(/has_function_privilege\('anon'/i);
  });

  it("keeps legacy event columns during expansion and binds tenants", () => {
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS ip_hash/i);
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS user_agent/i);
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS referer/i);
    expect(sql).toMatch(/tracked_link_recipient_organization_fkey/i);
    expect(sql).toMatch(/tracked_link_event_link_organization_fkey/i);
  });

  it("does not include the contract migration in the versioned path", () => {
    expect(
      existsSync("supabase/migrations/20260723190000_tracked_link_event_legacy_column_retirement.sql"),
    ).toBe(false);
  });

  it("checks the global analytics rate limit before token and visitor", () => {
    const globalPos = sql.indexOf("'tracked-link-analytics-global'");
    const tokenPos = sql.indexOf("'tracked-link-analytics-token'");
    const visitorPos = sql.indexOf("'tracked-link-analytics-visitor'");
    expect(globalPos).toBeGreaterThan(-1);
    expect(tokenPos).toBeGreaterThan(globalPos);
    expect(visitorPos).toBeGreaterThan(tokenPos);
  });
});
