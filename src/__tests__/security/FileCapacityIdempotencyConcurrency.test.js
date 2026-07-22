import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSql = readFileSync(
  "supabase/tests/file-capacity/idempotency-concurrency-worker.sql",
  "utf8",
);
const validationSql = readFileSync(
  "supabase/tests/file-capacity/validate-idempotency-concurrency.sql",
  "utf8",
);

describe("file capacity reservation idempotency concurrency", () => {
  it("returns the same reservation and file rows to concurrent identical retries", () => {
    expect(workerSql).toMatch(/v_scenario = 'idempotent_same'/);
    expect(validationSql).toMatch(/v_first\.outcome <> 'success' OR v_second\.outcome <> 'success'/);
    expect(validationSql).toMatch(/v_first\.reservation_id IS DISTINCT FROM v_second\.reservation_id/);
    expect(validationSql).toMatch(/v_first\.file_ids IS DISTINCT FROM v_second\.file_ids/);
    expect(validationSql).toMatch(/duplicated a reservation or file/);
  });

  it("rejects only the incompatible concurrent retry without partial rows", () => {
    expect(workerSql).toMatch(/v_scenario = 'idempotent_conflict'/);
    expect(validationSql).toMatch(/v_rejected\.sqlstate <> '23505'/);
    expect(validationSql).toContain("File capacity reservation key conflicts with another request");
    expect(validationSql).toMatch(/coalesce\(v_rejected\.constraint_name, ''\) <> ''/);
    expect(validationSql).toMatch(/persisted the rejected payload/);
  });
});
