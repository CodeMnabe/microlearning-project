import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260722120000_organization_file_capacity.sql",
  "utf8",
);
const reserveFunctionSql = sql.slice(
  sql.indexOf("CREATE OR REPLACE FUNCTION public.reserve_file_capacity"),
  sql.indexOf("CREATE OR REPLACE FUNCTION public.adjust_file_reserved_capacity"),
);

describe("organization file capacity migration", () => {
  it("is transactional and rerunnable", () => {
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql).toMatch(/COMMIT;\s*$/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.file_capacity_reservation/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS max_storage_bytes/i);
  });

  it("keeps commercial limits configurable instead of embedding plan values", () => {
    expect(sql).toMatch(/public\.plan ADD COLUMN IF NOT EXISTS max_files integer;/i);
    expect(sql).not.toMatch(/max_files integer DEFAULT \d/i);
    expect(sql).toMatch(/FILE_CAPACITY_NOT_CONFIGURED/);
  });

  it("locks the organization and resolves all limits before checking the idempotency key", () => {
    expect(reserveFunctionSql).toMatch(
      /SELECT\s+coalesce\(o\.max_files_override, p\.max_files\)[\s\S]+FOR UPDATE OF o;[\s\S]+SELECT r\.\* INTO v_existing/i,
    );
    expect(reserveFunctionSql.match(/FROM public\.organization AS o/gi)).toHaveLength(1);
  });

  it("creates the reservation and file rows inside the same RPC transaction", () => {
    expect(sql).toMatch(/INSERT INTO public\.file_capacity_reservation[\s\S]+INSERT INTO public\.file/i);
  });

  it("returns an identical reservation but rejects an incompatible duplicate key", () => {
    expect(sql).toMatch(/v_existing\.request_payload <> p_files/i);
    expect(sql).toMatch(/File capacity reservation key conflicts with another request/i);
    expect(sql).toMatch(/WHERE f\.capacity_reservation_id = v_existing\.id/i);
  });

  it("rejects invalid counts, sizes, expirations, flows, buckets, and paths", () => {
    expect(sql).toMatch(/v_file_count < 1 OR v_file_count > v_max_batch/i);
    expect(sql).toMatch(/\(v_item->>'size'\)::bigint <= 0/i);
    expect(sql).toMatch(/between 5 minutes and 24 hours/i);
    expect(sql).toMatch(/Unsupported upload flow/i);
    expect(sql).toMatch(/Invalid storage bucket/i);
    expect(sql).toMatch(/Invalid server-controlled object path/i);
  });

  it("uses server-controlled worst-case bytes until bounded validation", () => {
    expect(sql).toMatch(/v_per_file_reservation := 20 \* 1024 \* 1024/i);
    expect(sql).toMatch(/v_per_file_reservation := 5 \* 1024 \* 1024/i);
    expect(sql).toMatch(/adjust_file_reserved_capacity/i);
  });

  it("counts every file that is not fully deleted", () => {
    expect(sql).toMatch(/f\.status <> 'deleted'/i);
    expect(sql).toMatch(/sum\(f\.reserved_bytes\)/i);
  });

  it("keeps pending delete and remote uncertainty charged", () => {
    expect(sql).toMatch(/'pending_delete'/i);
    expect(sql).toMatch(/'unknown_outcome'/i);
    expect(sql).toMatch(/'reconciliation_required'/i);
    expect(sql).toMatch(/status IN \('active', 'reconciliation_required'\)/i);
  });

  it("only releases bytes after every applicable remote deletion", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.complete_file_cleanup/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.complete_file_capacity_reconciliation/i);
    expect(sql).toMatch(/p_remote_cleanup_confirmed/i);
    expect(sql).toMatch(/Remote cleanup is incomplete/i);
    expect(sql).toMatch(/reserved_bytes = 0/i);
  });

  it("requires a usable remote vector store id for reconciliation", () => {
    expect(sql).toMatch(/char_length\(btrim\(coalesce\(p_remote_vector_store_id, ''\)\)\) NOT BETWEEN 1 AND 255/i);
    expect(sql).toMatch(/remote_vector_store_id = btrim\(p_remote_vector_store_id\)/i);
  });

  it("makes expired reservations eligible for cleanup without releasing them", () => {
    expect(sql).toMatch(/coalesce\(r\.expires_at, f\.created_at \+ interval '24 hours'\) <= pg_catalog\.now\(\)/i);
    expect(sql).toMatch(/FOR UPDATE OF f SKIP LOCKED/i);
  });

  it("enforces tenant-consistent composite foreign keys", () => {
    expect(sql).toMatch(/FOREIGN KEY \(assistant_id, organization_id\)/i);
    expect(sql).toMatch(/FOREIGN KEY \(capacity_reservation_id, organization_id\)/i);
    expect(sql).toMatch(/assistant_vector_store_tenant_fkey/i);
  });

  it("reserves and materializes vector store capacity", () => {
    expect(sql).toMatch(/requested_vector_store_count BETWEEN 0 AND 1/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.materialize_vector_store_capacity/i);
    expect(sql).toMatch(/VECTOR_STORE_LIMIT_EXCEEDED/i);
    expect(sql).toMatch(/v_used_vector_stores >= v_max_vector_stores/i);
  });

  it("uses invoker rights and a safe search path", () => {
    const invokerFunctions = sql.match(/SECURITY INVOKER\s+SET search_path = ''/gi) ?? [];
    expect(invokerFunctions.length).toBeGreaterThanOrEqual(7);
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
  });

  it("blocks browser roles and grants only server execution", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.file_capacity_reservation FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.file, public\.vector_store FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.file, public\.vector_store FROM service_role/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reserve_file_capacity[\s\S]+TO service_role/i);
    expect(sql).toMatch(/'public\.claim_files_for_cleanup\(integer,interval\)'::regprocedure/i);
  });

  it("protects all sequences used by the invoker RPCs", () => {
    expect(sql).toMatch(/REVOKE ALL ON SEQUENCE public\.file_capacity_reservation_id_seq/i);
    expect(sql).toMatch(/REVOKE ALL ON SEQUENCE public\.file_id_seq/i);
    expect(sql).toMatch(/REVOKE ALL ON SEQUENCE public\.vector_store_id_seq/i);
  });
});
