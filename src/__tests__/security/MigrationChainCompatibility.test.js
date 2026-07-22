import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webhookSql = readFileSync(
  "supabase/migrations/20260717190000_webhook_event_processing.sql",
  "utf8",
);
const scheduledSql = readFileSync(
  "supabase/migrations/20260720170000_scheduled_broadcast_lifecycle.sql",
  "utf8",
);

describe("migration chain PostgreSQL compatibility", () => {
  it("uses the function-call form for schema-qualified substring", () => {
    expect(webhookSql).not.toMatch(/pg_catalog\.substring\(\s*[^,\n]+\s+from\s+/i);
    expect(webhookSql.match(/pg_catalog\.substring\(/g)).toHaveLength(4);
  });

  it("does not pass a dimensionless empty ACL array to aclexplode", () => {
    expect(scheduledSql).not.toMatch(/aclexplode\(\s*coalesce\([^)]*aclitem\[\]/i);
    expect(scheduledSql).toMatch(/aclexplode\(attribute\.attacl\)/i);
  });
});
