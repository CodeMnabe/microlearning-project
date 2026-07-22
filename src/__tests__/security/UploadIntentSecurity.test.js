import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as intentDocPOST } from "@/app/api/assistants/[assistantId]/files/intent/route";
import { POST as intentBroadcastPOST } from "@/app/api/broadcast/images/intent/route";

vi.mock("@/lib/services/oAi.services", () => ({
  createOAiVectorStore: vi.fn(),
  associateStoreToAssistant: vi.fn(),
  createOAiFile: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOrgForAssistant: vi.fn().mockResolvedValue({ orgId: 1, assistantId: 2, assistant: { open_ai_id: "asst_1" } }),
  requireOwnedOrg: vi.fn().mockResolvedValue({ orgId: 1 }),
  handleApiError: vi.fn((err, msg) => new Response(JSON.stringify({ error: msg }), { status: 500 })),
}));

vi.mock("@/lib/repos/files.repo", () => ({
  createDBFiles: vi.fn().mockResolvedValue([{ id: 10, object_path: "1/2/uuid.pdf", original_name: "test.pdf", size_bytes: 1024, mime_type: "application/pdf" }]),
  getFileById: vi.fn().mockResolvedValue({ id: 10, organization_id: 1, assistant_id: 2, bucket: "documents", object_path: "1/2/uuid.pdf", status: "pending_upload" }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://mock.com/upload" }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://mock.com/download" }, error: null }),
      }))
    }
  }))
}));

describe("Upload intent security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("document intent ignores client bucket and path, strictly generating UUIDs and checking limits", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({
        files: [
          { name: "test.pdf", size: 1024, type: "application/pdf", bucket: "hacker", path: "../../../secrets" }
        ]
      })
    };
    const ctx = { params: Promise.resolve({ assistantId: "2" }) };
    const res = await intentDocPOST(req, ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].uploadUrl).toBe("https://mock.com/upload");
    // bucket and path are controlled server-side, not returned to client
    expect(data.files[0].bucket).toBeUndefined();
    expect(data.files[0].path).toBeUndefined();
    expect(data.files[0].fileId).toBe(10);
  });

  it("document intent rejects oversized files", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({
        files: [
          { name: "huge.pdf", size: 30 * 1024 * 1024, type: "application/pdf" } // 30MB > 20MB
        ]
      })
    };
    const ctx = { params: Promise.resolve({ assistantId: "2" }) };
    const res = await intentDocPOST(req, ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("<= 20MB");
  });

  it("document intent rejects invalid mime types like HTML", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({
        files: [
          { name: "index.html", size: 1024, type: "text/html" }
        ]
      })
    };
    const ctx = { params: Promise.resolve({ assistantId: "2" }) };
    const res = await intentDocPOST(req, ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not allowed");
  });

  it("broadcast intent restricts images only and ignores paths", async () => {
    const req = {
      json: vi.fn().mockResolvedValue({
        orgId: 1,
        files: [
          { name: "pic.jpg", size: 1024, type: "image/jpeg", path: "../hack" }
        ]
      })
    };
    const res = await intentBroadcastPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].uploadUrl).toBe("https://mock.com/upload");
  });
});
