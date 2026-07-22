import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SENTINELS = Object.freeze([
  "+351911222333",
  "sensitive-user@example.invalid",
  "PRIVATE_MESSAGE_SENTINEL",
  "https://example.invalid/path?token=secret-link-value",
  "PROVIDER_RESPONSE_SECRET_SENTINEL",
]);

const state = vi.hoisted(() => ({
  rows: new Map(),
  errors: new Map(),
  cleanupFiles: [],
  cleanupError: null,
}));

function query(table) {
  const chain = {
    upsert: () => chain,
    update: () => chain,
    select: () => chain,
    delete: () => chain,
    eq: () => chain,
    single: async () => ({
      data: state.rows.get(table) ?? null,
      error: state.errors.get(table) ?? null,
    }),
    maybeSingle: async () => ({
      data: state.rows.get(table) ?? null,
      error: state.errors.get(table) ?? null,
    }),
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table) => query(table),
    rpc: async () => ({ data: state.cleanupFiles, error: state.cleanupError }),
  }),
}));

const lifecycle = vi.hoisted(() => ({
  deleteStorageObjectLifecycle: vi.fn(),
  deleteOpenAiFileLifecycle: vi.fn(),
  completeFileCleanup: vi.fn(),
  reconcilePendingFileCapacityReservations: vi.fn(),
}));

vi.mock("server-only", () => ({}), { virtual: true });

vi.mock("@/lib/helpers/storage.lifecycle", () => ({
  deleteStorageObjectLifecycle: lifecycle.deleteStorageObjectLifecycle,
}));
vi.mock("@/lib/helpers/openai.lifecycle", () => ({
  deleteOpenAiFileLifecycle: lifecycle.deleteOpenAiFileLifecycle,
}));
vi.mock("@/lib/repos/files.repo", () => ({
  completeFileCleanup: lifecycle.completeFileCleanup,
}));
vi.mock("@/lib/services/fileCapacityReconciliation.service", () => ({
  reconcilePendingFileCapacityReservations:
    lifecycle.reconcilePendingFileCapacityReservations,
}));
vi.mock("@/lib/services/fileCapacityReconciliation.service.js", () => ({
  reconcilePendingFileCapacityReservations:
    lifecycle.reconcilePendingFileCapacityReservations,
}));

import { upsertTeamsInstallation } from "@/lib/repos/teamsInstallations.repo";
import { getUserTeamsConversation } from "@/lib/repos/teamConversations.repo";
import { POST as cleanupFiles } from "@/app/api/cron/files/cleanup/route";

function captureConsole() {
  const lines = [];
  const spies = ["info", "warn", "error"].map((level) =>
    vi
      .spyOn(console, level)
      .mockImplementation((value) => lines.push(String(value))),
  );
  return { lines, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}

function expectNoSentinels(lines) {
  const output = lines.join("\n");
  for (const sentinel of SENTINELS) expect(output).not.toContain(sentinel);
}

describe("repository and file lifecycle logging", () => {
  let capture;
  let originalSecret;

  beforeEach(() => {
    vi.clearAllMocks();
    state.rows.clear();
    state.errors.clear();
    state.cleanupFiles = [];
    state.cleanupError = null;
    capture = captureConsole();
    originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cleanup-secret";
    lifecycle.deleteStorageObjectLifecycle.mockResolvedValue({ ok: true });
    lifecycle.deleteOpenAiFileLifecycle.mockResolvedValue({ ok: true });
    lifecycle.completeFileCleanup.mockResolvedValue({ id: "file-1" });
    lifecycle.reconcilePendingFileCapacityReservations.mockResolvedValue([]);
  });

  afterEach(() => {
    capture.restore();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("logs Teams installation persistence without the installation object", async () => {
    state.rows.set("teams_installation", {
      id: 1,
      organization_id: 7,
      assistant_id: 8,
      user_id: 11,
      service_url: SENTINELS[3],
      conversation_id: SENTINELS[2],
    });
    await upsertTeamsInstallation({
      organization_id: 7,
      assistant_id: 8,
      user_id: 11,
      service_url: SENTINELS[3],
      conversation_id: SENTINELS[2],
      tenant_id: SENTINELS[4],
    });
    expect(capture.lines.join("\n")).toContain("teams_installation_persisted");
    expectNoSentinels(capture.lines);
  });

  it("classifies Teams installation persistence errors safely", async () => {
    state.errors.set("teams_installation", new Error(SENTINELS[4]));
    await expect(
      upsertTeamsInstallation({ organization_id: 7, user_id: 11 }),
    ).rejects.toThrow(SENTINELS[4]);
    expect(capture.lines.join("\n")).toContain(
      "teams_installation_persistence_failed",
    );
    expectNoSentinels(capture.lines);
  });

  it("logs Teams conversation lookup without the conversation object", async () => {
    const row = {
      id: 1,
      user_id: 11,
      teams_user_id: SENTINELS[0],
      service_url: SENTINELS[3],
      conversation_id: SENTINELS[2],
    };
    state.rows.set("user_teams_conversation", row);
    const parse = vi.spyOn(JSON, "parse");
    const result = await getUserTeamsConversation(11);
    expect(result).toBe(row);
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
    expect(capture.lines.join("\n")).toContain(
      "teams_conversation_lookup_completed",
    );
    expectNoSentinels(capture.lines);
  });

  it("classifies Teams conversation lookup errors safely", async () => {
    state.errors.set("user_teams_conversation", new Error(SENTINELS[2]));
    await expect(getUserTeamsConversation(11)).rejects.toThrow(SENTINELS[2]);
    expect(capture.lines.join("\n")).toContain(
      "teams_conversation_lookup_failed",
    );
    expectNoSentinels(capture.lines);
  });

  it("logs file cleanup and reconciliation without paths or remote identifiers", async () => {
    state.cleanupFiles = [
      {
        id: "file-1",
        organization_id: 7,
        bucket: "private",
        object_path: SENTINELS[3],
        public_bucket: "public",
        public_object_path: SENTINELS[3],
        open_ai_id: SENTINELS[4],
      },
    ];
    const response = await cleanupFiles(
      new Request("http://worker.invalid/api/cron/files/cleanup", {
        method: "POST",
        headers: { authorization: "Bearer cleanup-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(capture.lines.join("\n")).toContain("file_cleanup_completed");
    expectNoSentinels(capture.lines);
  });

  it("classifies file cleanup errors without serializing the Error", async () => {
    state.cleanupError = new Error(SENTINELS[4]);
    await cleanupFiles(
      new Request("http://worker.invalid/api/cron/files/cleanup", {
        method: "POST",
        headers: { authorization: "Bearer cleanup-secret" },
      }),
    );
    expect(capture.lines.join("\n")).toContain("file_cleanup_failed");
    expectNoSentinels(capture.lines);
  });

  it("continues cleanup when the logging sink throws", async () => {
    state.cleanupFiles = [];
    console.info.mockImplementation(() => {
      throw new Error("synthetic sink failure");
    });

    const response = await cleanupFiles(
      new Request("http://worker.invalid/api/cron/files/cleanup", {
        method: "POST",
        headers: { authorization: "Bearer cleanup-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(
      lifecycle.reconcilePendingFileCapacityReservations,
    ).toHaveBeenCalledWith(20);
  });
});
