// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ payloads: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  throwHttpError(message, status) {
    throw Object.assign(new Error(message), { status });
  },
}));
vi.mock("@/lib/repos/broadcastMedia.repo", () => ({
  getPendingMessageRefs: mocks.payloads,
  removeStorageObject: mocks.remove,
  getStoragePublicUrl: vi.fn(),
  listStorageFolder: vi.fn(),
}));
import { deleteBroadcastMedia } from "@/lib/services/media/broadcastMedia.service";

const PATH = "broadcasts/7/1727860000000-abc123-manual.pdf";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.payloads.mockResolvedValue([]);
});

describe("deleteBroadcastMedia", () => {
  it("recusa ficheiros de outra organização ou fora dos buckets de multimédia", async () => {
    for (const target of [
      { bucket: "broadcast-media", path: "broadcasts/8/1-a-x.pdf" },
      { bucket: "broadcast-media", path: "broadcasts/7/../8/1-a-x.pdf" },
      { bucket: "assistant-uploads", path: PATH },
    ]) {
      await expect(deleteBroadcastMedia({}, 7, target)).rejects.toMatchObject({
        status: 400,
      });
    }
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("não apaga um ficheiro usado numa mensagem por enviar", async () => {
    mocks.payloads.mockResolvedValue([
      {
        kind: "scheduled",
        id: "b1",
        payload: { files: [{ url: `https://x.supabase.co/storage/v1/object/public/broadcast-media/${PATH}` }] },
      },
    ]);
    await expect(
      deleteBroadcastMedia({}, 7, { bucket: "broadcast-media", path: PATH }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("apaga um ficheiro livre da própria organização", async () => {
    await expect(
      deleteBroadcastMedia({}, 7, { bucket: "broadcast-media", path: PATH }),
    ).resolves.toEqual({ name: "manual.pdf" });
    expect(mocks.remove).toHaveBeenCalledWith({}, "broadcast-media", PATH);
  });
});
