import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BULK_TAG_OPERATIONS,
  bulkDeleteUsers,
  bulkModifyTags,
  bulkSetAssistant,
} from "@/lib/services/users/usersBulk.service";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  addTagsToUsers: vi.fn(),
  removeTagsFromUsers: vi.fn(),
  replaceTagsForUsers: vi.fn(),
}));

vi.mock("@/lib/repos/user.repo", () => ({
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
}));

vi.mock("@/lib/repos/userTags.repo", () => ({
  addTagsToUsers: mocks.addTagsToUsers,
  removeTagsFromUsers: mocks.removeTagsFromUsers,
  replaceTagsForUsers: mocks.replaceTagsForUsers,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateUser.mockResolvedValue({});
  mocks.deleteUser.mockResolvedValue(true);
  mocks.addTagsToUsers.mockResolvedValue();
  mocks.removeTagsFromUsers.mockResolvedValue();
  mocks.replaceTagsForUsers.mockResolvedValue();
});

describe("bulkSetAssistant", () => {
  it("reutiliza o update individual para preservar as regras de automação", async () => {
    await bulkSetAssistant({ userIds: [11, 12], assistantId: 3 });

    expect(mocks.updateUser).toHaveBeenCalledTimes(2);
    expect(mocks.updateUser).toHaveBeenNthCalledWith(1, 11, {
      assistantId: 3,
    });
    expect(mocks.updateUser).toHaveBeenNthCalledWith(2, 12, {
      assistantId: 3,
    });
  });
});

describe("bulkModifyTags", () => {
  it.each([
    [BULK_TAG_OPERATIONS.ADD, "addTagsToUsers"],
    [BULK_TAG_OPERATIONS.REMOVE, "removeTagsFromUsers"],
    [BULK_TAG_OPERATIONS.SET, "replaceTagsForUsers"],
  ])("encaminha a operação %s para o repo correto", async (op, repoMethod) => {
    const admin = { kind: "admin" };

    await bulkModifyTags(admin, {
      userIds: [11],
      tagIds: [5],
      op,
    });

    expect(mocks[repoMethod]).toHaveBeenCalledWith(admin, {
      userIds: [11],
      tagIds: [5],
    });
  });
});

describe("bulkDeleteUsers", () => {
  it("devolve um resumo quando uma remoção falha", async () => {
    mocks.deleteUser
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("Delete failed"));

    const result = await bulkDeleteUsers({ userIds: [11, 12] });

    expect(result).toEqual({
      ok: false,
      deleted: 1,
      failedCount: 1,
      failed: [{ id: 12, error: "Delete failed" }],
    });
  });
});
