import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260717000000_fix_data_api_boundaries.sql",
);
const snapshotPath = path.join(
  process.cwd(),
  "security-audit",
  "input",
  "supabase",
  "01-schema.sql",
);
const adminPagePath = path.join(
  process.cwd(),
  "src",
  "app",
  "[locale]",
  "(app)",
  "admin",
  "page.js",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const snapshot = fs.readFileSync(snapshotPath, "utf8");
const adminPage = fs.readFileSync(adminPagePath, "utf8");

describe("Data API boundaries migration contract", () => {
  it("removes direct organization and user mutation grants", () => {
    expect(migration).toMatch(
      /revoke all privileges on table public\.organization\s+from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant select on table public\.organization to authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\."user"\s+from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant select on table public\."user" to authenticated/i,
    );
  });

  it("removes direct column ACLs before restoring authenticated table SELECT", () => {
    expect(migration).toMatch(/from pg_catalog\.pg_attribute as attribute/i);
    expect(migration).toMatch(
      /attribute\.attrelid in \([\s\S]*'public\.organization'::regclass,[\s\S]*'public\."user"'::regclass/i,
    );
    expect(migration).toMatch(
      /revoke select \(%1\$I\), insert \(%1\$I\), update \(%1\$I\), references \(%1\$I\) on table %2\$s from public, anon, authenticated/i,
    );

    const tableRevoke = migration.indexOf(
      "revoke all privileges on table public.organization",
    );
    const columnRevoke = migration.indexOf(
      "revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I)",
    );
    const authenticatedSelect = migration.indexOf(
      "grant select on table public.organization to authenticated",
    );

    expect(tableRevoke).toBeGreaterThan(-1);
    expect(columnRevoke).toBeGreaterThan(tableRevoke);
    expect(authenticatedSelect).toBeGreaterThan(columnRevoke);
  });

  it("validates effective column privileges and fails on inherited grants", () => {
    expect(migration).toMatch(/pg_catalog\.has_column_privilege/i);

    for (const privilege of ["SELECT", "INSERT", "UPDATE", "REFERENCES"]) {
      expect(migration).toMatch(
        new RegExp(
          `has_column_privilege\\([\\s\\S]*?'anon'[\\s\\S]*?'${privilege}'`,
          "i",
        ),
      );
    }

    for (const privilege of ["INSERT", "UPDATE", "REFERENCES"]) {
      expect(migration).toMatch(
        new RegExp(
          `has_column_privilege\\([\\s\\S]*?'authenticated'[\\s\\S]*?'${privilege}'`,
          "i",
        ),
      );
    }

    expect(migration).toMatch(/anon inherits column privilege on %s/i);
    expect(migration).toMatch(
      /authenticated inherits forbidden column privilege on %s/i,
    );
    expect(migration).toMatch(
      /authenticated column SELECT is missing on %s/i,
    );
  });

  it("allows only authenticated SELECT and checks every dangerous table privilege", () => {
    for (const privilege of [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `has_table_privilege\\([\\s\\S]*?'anon'[\\s\\S]*?'${privilege}'`,
          "i",
        ),
      );
    }

    for (const privilege of [
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `has_table_privilege\\([\\s\\S]*?'authenticated'[\\s\\S]*?'${privilege}'`,
          "i",
        ),
      );
    }

    expect(migration).toMatch(
      /not pg_catalog\.has_table_privilege\([\s\S]*?'authenticated'[\s\S]*?'SELECT'/i,
    );
    expect(migration).toMatch(/anon inherits table privilege on %s/i);
    expect(migration).toMatch(
      /authenticated inherits forbidden table privilege on %s/i,
    );
  });

  it("restricts the user-creation RPC to service_role", () => {
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/set search_path = ''/i);
    expect(migration).toMatch(/current_user <> 'service_role'/i);
    expect(migration).toMatch(
      /from public, anon, authenticated/i,
    );
    expect(migration).toMatch(/to service_role/i);
    expect(migration).toMatch(/has_function_privilege/i);
  });

  it("discovers associated sequences and removes browser/PUBLIC privileges", () => {
    expect(migration).toMatch(/pg_catalog\.pg_get_serial_sequence/i);
    expect(migration).toMatch(/from pg_catalog\.pg_depend/i);
    expect(migration).toMatch(/dependency\.deptype in \('a', 'i'\)/i);
    expect(migration).toMatch(
      /revoke all privileges on sequence %s from public, anon, authenticated/i,
    );
    expect(migration).toMatch(/grant usage on sequence %s to service_role/i);
    expect(migration).toMatch(/indispensable id sequence dependency is missing/i);
    expect(migration).not.toMatch(
      /revoke all privileges on sequence public\.(?:organization_id_seq|user_id_seq1?)/i,
    );
  });

  it("grants the SECURITY INVOKER RPC minimum table privileges explicitly", () => {
    expect(migration).toMatch(
      /grant select, update on table public\.organization to service_role/i,
    );
    expect(migration).toMatch(
      /grant select on table public\.assistant to service_role/i,
    );
    expect(migration).toMatch(
      /grant select on table public\.plan to service_role/i,
    );
    expect(migration).toMatch(
      /grant select, insert, update, delete on table public\."user" to service_role/i,
    );
  });

  it("keeps all server-side user mutation privileges on service_role", () => {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      expect(migration).toMatch(
        new RegExp(
          `not pg_catalog\\.has_table_privilege\\([\\s\\S]*?'service_role'[\\s\\S]*?'public\\."user"'[\\s\\S]*?'${privilege}'`,
          "i",
        ),
      );
    }

    expect(migration).toMatch(
      /service_role lacks required user table privileges/i,
    );
  });

  it("serializes the limit check and validates assistant ownership", () => {
    expect(migration).toMatch(
      /lock table public\.organization in share row exclusive mode/i,
    );
    expect(migration).toMatch(/for update of o/i);
    expect(migration).toMatch(
      /a\.organization_id = p_organization_id/i,
    );
    expect(migration).toMatch(/v_user_count >= v_effective_max_users/i);
  });

  it("prevents concurrent last-slot RPC calls from both passing the count", () => {
    const organizationLock = migration.indexOf("for update of o");
    const userCount = migration.indexOf("select count(*)::integer");
    const insert = migration.indexOf('insert into public."user"');

    expect(organizationLock).toBeGreaterThan(-1);
    expect(userCount).toBeGreaterThan(organizationLock);
    expect(insert).toBeGreaterThan(userCount);
  });

  it("enforces same-tenant user and assistant relations structurally", () => {
    expect(migration).toMatch(
      /unique \(id, organization_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(assistant_id, organization_id\)[\s\S]*references public\.assistant \(id, organization_id\)/i,
    );
    expect(migration).toMatch(/on delete set null \(assistant_id\)/i);
  });

  it("uses PostgreSQL 15 syntax only on 15+ and installs an older-version fallback", () => {
    expect(migration).toMatch(/server_version_num/i);
    expect(migration).toMatch(/v_server_version_num >= 150000/i);
    expect(migration).toMatch(
      /create function public\.clear_user_assistant_reference_before_delete/i,
    );
    expect(migration).toMatch(
      /before delete on public\.assistant[\s\S]*execute function public\.clear_user_assistant_reference_before_delete/i,
    );
    expect(migration).toMatch(/set assistant_id = null/i);
    expect(migration).toMatch(/on delete no action/i);
    expect(migration).toMatch(
      /grant select, insert, update, delete on table public\."user" to service_role/i,
    );
    expect(migration).toMatch(
      /not pg_catalog\.has_table_privilege\([\s\S]*?'service_role'[\s\S]*?'public\."user"'[\s\S]*?'UPDATE'/i,
    );
  });

  it("preflights and constrains exact external identifiers", () => {
    expect(migration).toMatch(/having count\(\*\) > 1/i);
    expect(migration).toMatch(/btrim\(o\.channel_id\) = ''/i);
    expect(migration).toMatch(/unique \(channel_id\)/i);
    expect(migration).toMatch(/check \(btrim\(channel_id\) <> ''\)/i);
    expect(migration).toMatch(
      /check \(teams_tenant_id is null or btrim\(teams_tenant_id\) <> ''\)/i,
    );
    expect(migration).not.toMatch(/lower\s*\(\s*channel_id/i);
  });

  it("recognizes the snapshot Teams UNIQUE by exact catalog definition", () => {
    expect(snapshot).toMatch(
      /organization_teams_tenant_id_key[\s\S]*unique \("teams_tenant_id"\)/i,
    );
    expect(migration).toMatch(
      /c\.contype = 'u'[\s\S]*c\.conkey = array\[v_attnum\]::smallint\[\]/i,
    );
  });

  it("adds an exact Teams UNIQUE when the remote snapshot has none", () => {
    expect(migration).toMatch(
      /if not v_has_exact_unique then[\s\S]*add constraint %I unique \(teams_tenant_id\)/i,
    );
    expect(migration).toMatch(
      /constraint name %s is occupied but no exact teams_tenant_id UNIQUE exists/i,
    );
    expect(migration).toMatch(
      /failed to enforce exact UNIQUE on organization\.teams_tenant_id/i,
    );
  });

  it("removes obsolete mutation policies and keeps SELECT policies untouched", () => {
    expect(migration).toMatch(
      /drop policy if exists "owners can update" on public\.organization/i,
    );
    expect(migration).toMatch(
      /drop policy if exists "owner can insert users" on public\."user"/i,
    );
    expect(migration).toMatch(
      /drop policy if exists "owner can update users" on public\."user"/i,
    );
    expect(migration).toMatch(
      /drop policy if exists "owner can delete users" on public\."user"/i,
    );
    expect(migration).not.toMatch(/drop policy[^;]+read/is);
  });

  it("contains no direct browser-side organization insert or update", () => {
    expect(adminPage).not.toMatch(
      /\.from\("organization"\)[\s\S]{0,250}\.(?:insert|update|delete)\(/,
    );
    expect(adminPage).toContain('fetch("/api/organizations"');
    expect(adminPage).not.toContain("channelId");
    expect(adminPage).not.toContain('method: "POST"');
  });
});
