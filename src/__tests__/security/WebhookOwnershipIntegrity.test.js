import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260717190000_webhook_event_processing.sql"),
  "utf8",
);
const messageBirdRoute = readFileSync(
  resolve("src/app/api/messagebird/route.js"),
  "utf8",
);
const cronRoute = readFileSync(
  resolve("src/app/api/cron/webhook-events/route.js"),
  "utf8",
);
const vercel = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));

function sqlFunction(name) {
  const marker = `create or replace function public.${name}(`;
  const start = migration.toLowerCase().indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe("webhook ownership integrity", () => {
  it("schedules the authenticated webhook worker every two minutes", () => {
    expect(vercel.crons).toContainEqual({
      path: "/api/cron/webhook-events",
      schedule: "*/2 * * * *",
    });
    expect(cronRoute).toMatch(/process\.env\.CRON_SECRET/);
    expect(cronRoute).toMatch(/Bearer /);
    expect(cronRoute).toMatch(/status: 401/);
  });

  it("rejects assistants outside the reservation organization", () => {
    const fn = sqlFunction("register_conversation_reservation");
    expect(fn).toMatch(/from public\.assistant as assistant_row/i);
    expect(fn).toMatch(/assistant_row\.id = p_assistant_id/i);
    expect(fn).toMatch(/assistant_row\.organization_id = p_organization_id/i);
    expect(fn).toMatch(
      /assistant does not belong to reservation organization/i,
    );
  });

  it("rejects users outside the reservation organization", () => {
    const fn = sqlFunction("register_conversation_reservation");
    expect(fn).toMatch(/from public\."user" as user_row/i);
    expect(fn).toMatch(/user_row\.id = p_user_id/i);
    expect(fn).toMatch(/user_row\.organization_id = p_organization_id/i);
    expect(fn).toMatch(/user does not belong to reservation organization/i);
  });

  it("requires an exact Teams conversation when initializing a reservation", () => {
    const fn = sqlFunction("register_conversation_reservation");
    expect(fn).toMatch(/\^tenant:\[\^:\]\+:conversation:\(\.\+\)\$/);
    expect(fn).toMatch(
      /thread_row\.external_conversation_id = v_teams_conversation_id/i,
    );
    expect(fn).toMatch(/p_user_id is null and thread_row\.scope = 'group'/i);
    expect(fn).toMatch(/thread_row\.assistant_id = p_assistant_id/i);
    expect(fn).toMatch(/thread_row\.channel = pg_catalog\.btrim\(p_channel\)/i);
    expect(fn).toMatch(
      /organization_row\.teams_tenant_id = v_teams_tenant_id/i,
    );
    expect(fn).toMatch(
      /organization_row\.channel_id = v_messagebird_channel_id/i,
    );
  });

  it("rejects an associated thread with a different reservation identity", () => {
    const fn = sqlFunction("associate_conversation_reservation_thread");
    expect(fn).toMatch(
      /thread_row\.assistant_id = reservation_row\.assistant_id/i,
    );
    expect(fn).toMatch(/thread_row\.channel = reservation_row\.channel/i);
    expect(fn).toMatch(/thread_row\.scope = 'group'/i);
    expect(fn).toMatch(
      /thread_row\.external_conversation_id = pg_catalog\.substring/i,
    );
    expect(fn).toMatch(
      /assistant_row\.organization_id = reservation_row\.organization_id/i,
    );
    expect(fn).toMatch(
      /user_row\.organization_id = reservation_row\.organization_id/i,
    );
  });

  it.each(["processing", "succeeded"])(
    "does not alter an event winner in %s when the payload conflicts",
    (status) => {
      const fn = sqlFunction("register_webhook_event");
      const conflict = fn.match(
        /if v_event\.payload_hash <> p_payload_hash then([\s\S]*?)end if;/i,
      )?.[1];
      expect(conflict).toBeTruthy();
      expect(conflict).not.toMatch(/update public\.webhook_event/i);
      expect(conflict).toMatch(/'payload_conflict'/i);
      expect(conflict).toMatch(/v_event\.status/i);

      const canonical = { status, claimToken: "winner", lastError: null };
      const observedConflict = { outcome: "payload_conflict" };
      expect(observedConflict.outcome).toBe("payload_conflict");
      expect(canonical).toEqual({
        status,
        claimToken: "winner",
        lastError: null,
      });
    },
  );

  it("reports an effect hash conflict without changing the canonical effect", () => {
    const fn = sqlFunction("register_webhook_effect");
    const conflict = fn.match(
      /if v_effect\.request_hash is distinct from p_request_hash then([\s\S]*?)end if;/i,
    )?.[1];
    expect(conflict).toBeTruthy();
    expect(conflict).not.toMatch(/update public\.webhook_effect/i);
    expect(conflict).toMatch(/v_effect\.status := 'conflict'/i);
    expect(conflict).toMatch(/local row variable/i);
  });

  it("renews pending outreach only for both active claim owners", () => {
    const fn = sqlFunction("renew_pending_outreach_for_webhook");
    expect(fn).toMatch(/p_lease_seconds < 15 or p_lease_seconds > 900/i);
    expect(fn).toMatch(/event_row\.status = 'processing'/i);
    expect(fn).toMatch(/event_row\.claim_token = p_event_claim_token/i);
    expect(fn).toMatch(/pending_row\.status = 'processing'/i);
    expect(fn).toMatch(/pending_row\.claim_token = p_claim_token/i);
    expect(fn.match(/claim_expires_at >= pg_catalog\.now\(\)/gi)).toHaveLength(
      2,
    );
  });

  it("blocks a second pending claim while a renewed lease is valid", () => {
    const fn = sqlFunction("claim_pending_outreach_for_webhook");
    expect(fn).toMatch(
      /pending_row\.status = 'processing'[\s\S]*pending_row\.claim_expires_at < pg_catalog\.now\(\)/i,
    );
    expect(fn).not.toMatch(/claim_expires_at <= pg_catalog\.now\(\)/i);
  });

  it("does not let an old pending token finalize another worker's claim", () => {
    const fn = sqlFunction("transition_pending_outreach_for_webhook");
    expect(fn).toMatch(/pending_row\.webhook_event_id = p_webhook_event_id/i);
    expect(fn).toMatch(/pending_row\.status = 'processing'/i);
    expect(fn).toMatch(/pending_row\.claim_token = p_claim_token/i);
    expect(fn).toMatch(/pending_row\.claim_expires_at >= pg_catalog\.now\(\)/i);
  });

  it("heartbeats pending outreach and records send start before Bird", () => {
    expect(messageBirdRoute).toMatch(/label: "pending outreach"/);
    expect(messageBirdRoute).toMatch(/renewPendingOutreachForWebhook/);
    expect(messageBirdRoute).toMatch(/markPendingOutreachSendStarted/);
    const pendingSendStart = messageBirdRoute.lastIndexOf(
      "markPendingOutreachSendStarted({",
    );
    expect(pendingSendStart).toBeGreaterThanOrEqual(0);
    expect(pendingSendStart).toBeLessThan(
      messageBirdRoute.indexOf(
        "const sendRes = await sendBirdMessage",
        pendingSendStart,
      ),
    );
    expect(messageBirdRoute).toMatch(
      /finally \{[\s\S]*await pendingHeartbeat\?\.stop\(\)/,
    );
  });

  it("preserves unknown pending send outcomes instead of reclaiming them", () => {
    const claim = sqlFunction("claim_pending_outreach_for_webhook");
    expect(claim).toMatch(
      /status = 'unknown_outcome'[\s\S]*send_started_at is not null/i,
    );
    expect(claim).toMatch(/pending_row\.send_started_at is null/i);
  });

  it("preserves browser message capabilities without granting new ones", () => {
    expect(migration).toMatch(/pg_catalog\.has_column_privilege/i);
    expect(migration).toMatch(/if v_columns is not null then/i);
    expect(migration).toMatch(
      /column_row\.attname not in \('webhook_event_id', 'webhook_effect_key'\)/i,
    );
    expect(migration).not.toMatch(
      /grant (?:select|insert|update) \([\s\S]*?\) on public\.message to anon, authenticated/i,
    );
  });
});
