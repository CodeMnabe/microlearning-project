import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { POST as documentIntent } from "@/app/api/assistants/[assistantId]/files/intent/route";
import { POST as broadcastIntent } from "@/app/api/broadcast/images/intent/route";
import { POST as broadcastFinalize } from "@/app/api/broadcast/images/finalize/route";
import {
  getFileById,
  getFileCapacityReservation,
  reserveFileCapacity,
} from "@/lib/repos/files.repo";

vi.mock("@/lib/auth/guards", () => ({
  requireOrgForAssistant: vi.fn().mockResolvedValue({ orgId: 7, assistantId: 11 }),
  requireOwnedOrg: vi.fn().mockResolvedValue({ orgId: 7 }),
  handleApiError: vi.fn((error, message) =>
    new Response(JSON.stringify({ error: error?.message || message }), { status: 500 })),
}));

vi.mock("@/lib/repos/files.repo", () => ({
  reserveFileCapacity: vi.fn(),
  markFilePendingDelete: vi.fn().mockResolvedValue(true),
  getFileById: vi.fn(),
  getFileCapacityReservation: vi.fn(),
  adjustFileReservedCapacity: vi.fn(),
  transitionFileLifecycle: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://local.invalid/upload" },
          error: null,
        }),
        createSignedUrl: vi.fn(),
        upload: vi.fn(),
        remove: vi.fn(),
      })),
    },
  })),
}));

const reservationKey = "123e4567-e89b-42d3-a456-426614174000";
const documentIntentSource = readFileSync(
  "src/app/api/assistants/[assistantId]/files/intent/route.js",
  "utf8",
);
const vectorStoreSource = readFileSync(
  "src/app/api/assistants/[assistantId]/vector-store/route.js",
  "utf8",
);
const broadcastFinalizeSource = readFileSync(
  "src/app/api/broadcast/images/finalize/route.js",
  "utf8",
);
const broadcastIntentSource = readFileSync(
  "src/app/api/broadcast/images/intent/route.js",
  "utf8",
);
const oldFileRouteSource = readFileSync(
  "src/app/api/assistants/[assistantId]/files/route.js",
  "utf8",
);
const filesRepoSource = readFileSync("src/lib/repos/files.repo.js", "utf8");
const storeRepoSource = readFileSync("src/lib/repos/store.repo.js", "utf8");
const broadcastPageSource = readFileSync(
  "src/app/[locale]/(app)/broadcast/page.js",
  "utf8",
);
const cleanupSource = readFileSync("src/app/api/cron/files/cleanup/route.js", "utf8");
const reconciliationServiceSource = readFileSync(
  "src/lib/services/fileCapacityReconciliation.service.js",
  "utf8",
);

describe("file capacity route integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reserveFileCapacity).mockImplementation(async (request) =>
      request.files.map((file, index) => ({ id: index + 1, ...file })),
    );
    vi.mocked(getFileById).mockResolvedValue({
      id: 44,
      organization_id: 7,
      capacity_reservation_id: 99,
      upload_flow: "broadcast_intent",
      bucket: "quarantine_images",
      object_path: `broadcasts/7/${reservationKey}-0.png`,
      status: "pending_upload",
    });
    vi.mocked(getFileCapacityReservation).mockResolvedValue({
      id: 99,
      organization_id: 7,
      assistant_id: null,
      upload_flow: "broadcast_intent",
    });
  });

  it("uses the shared reservation RPC for document uploads", async () => {
    const response = await documentIntent(
      {
        json: vi.fn().mockResolvedValue({
          reservationKey,
          files: [{ name: "guide.pdf", type: "application/pdf", size: 1200 }],
        }),
      },
      { params: Promise.resolve({ assistantId: "11" }) },
    );

    expect(response.status).toBe(200);
    expect(reserveFileCapacity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 7,
      assistantId: 11,
      reservationKey,
      uploadFlow: "document_intent",
      requestedVectorStoreCount: 1,
    }));
    const request = vi.mocked(reserveFileCapacity).mock.calls[0][0];
    expect(request.files[0].reserved_bytes).toBe(20 * 1024 * 1024);
    expect(request.files[0].object_path).toContain(`7/11/${reservationKey}-0.pdf`);
  });

  it("uses the same reservation RPC for broadcast uploads", async () => {
    const response = await broadcastIntent({
      json: vi.fn().mockResolvedValue({
        orgId: 999,
        reservationKey,
        files: [{ name: "image.jpg", type: "image/jpeg", size: 800 }],
      }),
    });

    expect(response.status).toBe(200);
    expect(reserveFileCapacity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 7,
      reservationKey,
      uploadFlow: "broadcast_intent",
      requestedVectorStoreCount: 0,
    }));
    const request = vi.mocked(reserveFileCapacity).mock.calls[0][0];
    expect(request.files[0].reserved_bytes).toBe(5 * 1024 * 1024);
    expect(request.files[0].object_path).toContain(`broadcasts/7/${reservationKey}-0.jpeg`);
  });

  it("rejects missing or malformed idempotency keys before reserving", async () => {
    const response = await documentIntent(
      { json: vi.fn().mockResolvedValue({ files: [{ name: "a.pdf", type: "application/pdf", size: 1 }] }) },
      { params: Promise.resolve({ assistantId: "11" }) },
    );
    expect(response.status).toBe(400);
    expect(reserveFileCapacity).not.toHaveBeenCalled();
  });

  it("maps aggregate limit rejection to conflict", async () => {
    vi.mocked(reserveFileCapacity).mockRejectedValueOnce(new Error("STORAGE_BYTES_LIMIT_EXCEEDED"));
    const response = await broadcastIntent({
      json: vi.fn().mockResolvedValue({
        orgId: 7,
        reservationKey,
        files: [{ name: "image.png", type: "image/png", size: 100 }],
      }),
    });
    expect(response.status).toBe(409);
  });

  it("fails closed when the organization has no configured capacity", async () => {
    vi.mocked(reserveFileCapacity).mockRejectedValueOnce(new Error("FILE_CAPACITY_NOT_CONFIGURED"));
    const response = await broadcastIntent({
      json: vi.fn().mockResolvedValue({
        orgId: 7,
        reservationKey,
        files: [{ name: "image.webp", type: "image/webp", size: 100 }],
      }),
    });
    expect(response.status).toBe(503);
  });

  it("retains signed-upload reservations when URL generation fails", () => {
    expect(documentIntentSource).toMatch(/Promise\.allSettled[\s\S]+markFilePendingDelete/);
    expect(documentIntentSource).toMatch(/signed_upload_url_failed/);
  });

  it("moves an invalid final size to cleanup without releasing bytes", () => {
    expect(broadcastFinalizeSource).toMatch(/adjustFileReservedCapacity/);
    expect(broadcastFinalizeSource).toMatch(/markFilePendingDelete[\s\S]+final_size_capacity_rejected/);
  });

  it("binds broadcast finalization to the server-derived organization and reservation", () => {
    expect(broadcastFinalizeSource).toMatch(/getFileById\(fileId, orgAuth\.orgId\)/);
    expect(broadcastFinalizeSource).toMatch(/getFileCapacityReservation\(orgAuth\.orgId, reservationKey\)/);
    expect(broadcastFinalizeSource).toMatch(/capacity_reservation_id[\s\S]+reservation\.id/);
    expect(broadcastFinalizeSource).toMatch(/upload_flow !== "broadcast_intent"/);
    expect(broadcastFinalizeSource).toMatch(/bucket !== "quarantine_images"/);
    expect(broadcastPageSource).toMatch(/reservationKey: intentData\.reservationKey/);
  });

  it("rejects a file from a different reservation during broadcast finalization", async () => {
    vi.mocked(getFileById).mockResolvedValueOnce({
      id: 44,
      organization_id: 7,
      capacity_reservation_id: 100,
      upload_flow: "broadcast_intent",
      bucket: "quarantine_images",
      object_path: `broadcasts/7/${reservationKey}-0.png`,
      status: "pending_upload",
    });

    const response = await broadcastFinalize({
      json: vi.fn().mockResolvedValue({ orgId: 999, fileId: 44, reservationKey }),
    });

    expect(response.status).toBe(403);
    expect(getFileById).toHaveBeenCalledWith(44, 7);
    expect(getFileCapacityReservation).toHaveBeenCalledWith(7, reservationKey);
  });

  it("has no legacy creation handler and routes both creation flows through the reservation RPC", () => {
    expect(oldFileRouteSource).not.toMatch(/export async function (POST|PUT|PATCH)/);
    expect(documentIntentSource).toMatch(/reserveFileCapacity/);
    expect(broadcastIntentSource).toMatch(/reserveFileCapacity/);
    expect(filesRepoSource).not.toMatch(/\.from\(["']file["']\)[\s\S]{0,120}\.(insert|upsert)\(/);
    expect(storeRepoSource).toMatch(/rpc\("materialize_vector_store_capacity"/);
    expect(storeRepoSource).not.toMatch(/\.insert\(/);
  });

  it("returns a materialized vector store before any retry can create a remote duplicate", () => {
    expect(vectorStoreSource).toMatch(
      /const existingStore[\s\S]+if \(existingStore\?\.status === "active"\)[\s\S]+return storeResponse\(existingStore, reservedFiles\)[\s\S]+createOpenAiVectorStoreLifecycle/,
    );
  });

  it("compensates a remote vector store when DB materialization fails", () => {
    expect(vectorStoreSource).toMatch(/catch \(materializationError\)[\s\S]+deleteOpenAiVectorStoreLifecycle/);
  });

  it("persists reconciliation when vector store compensation also fails", () => {
    expect(vectorStoreSource).toMatch(/if \(!compensation\.ok\)[\s\S]+markFileCapacityReconciliationRequired/);
    expect(vectorStoreSource).toMatch(/remoteVectorStoreId: remoteStore\.id/);
  });

  it("does not create an unusable reconciliation after an unknown create outcome", () => {
    expect(vectorStoreSource).not.toMatch(/vectorResult\.outcome === "unknown_outcome"[\s\S]{0,300}markFileCapacityReconciliationRequired/);
  });

  it("finishes reconciliation only after every remote delete succeeds", () => {
    expect(reconciliationServiceSource).toMatch(/^import "server-only";/);
    expect(reconciliationServiceSource).toMatch(/deleteOpenAiVectorStoreLifecycle[\s\S]+deleteReservationFileRemotes[\s\S]+completeFileCapacityReconciliation/);
    expect(reconciliationServiceSource).toMatch(/remoteCleanupConfirmed: true/);
    expect(cleanupSource).toMatch(/reconcilePendingFileCapacityReservations/);
    expect(cleanupSource).toMatch(/CRON_SECRET/);
  });

  it("releases capacity only through the remote-aware cleanup RPC", () => {
    expect(cleanupSource).toMatch(/storageDeleted && publicObjectDeleted && openaiDeleted/);
    expect(cleanupSource).toMatch(/completeFileCleanup/);
    expect(cleanupSource).not.toMatch(/reserved_bytes\s*:\s*0/);
  });
});
