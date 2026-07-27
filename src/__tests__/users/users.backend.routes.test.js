import { beforeEach, describe, expect, it, vi } from "vitest";

import * as usersRoute from "@/app/api/users/route";
import * as bulkRoute from "@/app/api/users/bulk/route";
import { POST as bulkTagsPost } from "@/app/api/users/bulk-tags/route";
import { POST as importUsersPost } from "@/app/api/users/import/route";
import * as tagsRoute from "@/app/api/tags/route";

const mocks = vi.hoisted(() => ({
  admin: { kind: "admin" },

  requireOwnedOrg: vi.fn(),
  requireOrgForUser: vi.fn(),
  assertUsersBelongToOrg: vi.fn(),
  assertTagsBelongToOrg: vi.fn(),
  assertAssistantBelongsToOrg: vi.fn(),

  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  bulkSetAssistant: vi.fn(),
  bulkModifyTags: vi.fn(),
  bulkDeleteUsers: vi.fn(),
  importUsers: vi.fn(),

  getTagsInOrg: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  requireOrgForTag: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mocks.admin,
}));

vi.mock("@/lib/auth/guards", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    requireOwnedOrg: mocks.requireOwnedOrg,
    requireOrgForUser: mocks.requireOrgForUser,
    requireOrgForTag: mocks.requireOrgForTag,
    assertUsersBelongToOrg: mocks.assertUsersBelongToOrg,
    assertTagsBelongToOrg: mocks.assertTagsBelongToOrg,
    assertAssistantBelongsToOrg: mocks.assertAssistantBelongsToOrg,
  };
});

vi.mock("@/lib/services/users", () => ({
  BULK_TAG_OPERATIONS: {
    ADD: "add",
    REMOVE: "remove",
    SET: "set",
  },
  listUsers: mocks.listUsers,
  createUser: mocks.createUser,
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
  bulkSetAssistant: mocks.bulkSetAssistant,
  bulkModifyTags: mocks.bulkModifyTags,
  bulkDeleteUsers: mocks.bulkDeleteUsers,
  importUsers: mocks.importUsers,
}));

vi.mock("@/lib/repos/tag.repo.js", () => ({
  getTagsInOrg: mocks.getTagsInOrg,
  createTag: mocks.createTag,
  updateTag: mocks.updateTag,
  deleteTag: mocks.deleteTag,
}));

function jsonRequest(url, body) {
  return {
    url,
    json: vi.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.requireOwnedOrg.mockResolvedValue({
    orgId: 7,
    admin: mocks.admin,
  });
  mocks.requireOrgForUser.mockResolvedValue({
    orgId: 7,
    userId: 11,
    admin: mocks.admin,
  });
  mocks.requireOrgForTag.mockResolvedValue({
    orgId: 7,
    tagId: 5,
    admin: mocks.admin,
  });
  mocks.assertUsersBelongToOrg.mockImplementation(
    async (_admin, _orgId, ids) => ids,
  );
  mocks.assertTagsBelongToOrg.mockImplementation(
    async (_admin, _orgId, ids) => ids,
  );
  mocks.assertAssistantBelongsToOrg.mockImplementation(
    async (_admin, _orgId, id) => (id == null || id === "" ? null : Number(id)),
  );

  mocks.listUsers.mockResolvedValue({
    items: [{ id: 11 }],
    total: 1,
    page: 2,
    pageSize: 200,
  });
  mocks.createUser.mockResolvedValue({ id: 11, name: "Alice" });
  mocks.updateUser.mockResolvedValue({ id: 11, name: "Alice" });
  mocks.deleteUser.mockResolvedValue(true);
  mocks.bulkSetAssistant.mockResolvedValue([]);
  mocks.bulkModifyTags.mockResolvedValue();
  mocks.bulkDeleteUsers.mockResolvedValue({
    ok: true,
    deleted: 2,
    failedCount: 0,
    failed: [],
  });
  mocks.importUsers.mockResolvedValue({
    totalReceived: 1,
    created: 1,
    updated: 0,
    skipped: 0,
    failed: 0,
    skippedRows: [],
    failedRows: [],
  });
  mocks.getTagsInOrg.mockResolvedValue([{ id: 5, name: "VIP" }]);
  mocks.createTag.mockResolvedValue({ id: 5, name: "VIP" });
  mocks.updateTag.mockResolvedValue({ id: 5, name: "Priority" });
  mocks.deleteTag.mockResolvedValue(true);
});

describe("/api/users", () => {
  it("autoriza a organização antes de listar e limita o pageSize", async () => {
    const response = await usersRoute.GET({
      url: "http://localhost/api/users?orgId=7&page=2&pageSize=500",
    });

    expect(mocks.requireOwnedOrg).toHaveBeenCalledWith("7");
    expect(mocks.listUsers).toHaveBeenCalledWith({
      orgId: 7,
      page: 2,
      pageSize: 200,
    });
    expect(response.status).toBe(200);
  });

  it("não lista quando o guard recusa a organização", async () => {
    const forbidden = new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    mocks.requireOwnedOrg.mockResolvedValueOnce({ error: forbidden });

    const response = await usersRoute.GET({
      url: "http://localhost/api/users?orgId=99",
    });

    expect(response.status).toBe(403);
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("valida o assistente na organização antes de criar", async () => {
    const response = await usersRoute.POST(
      jsonRequest("http://localhost/api/users", {
        organizationId: 7,
        name: " Alice ",
        assistantId: "3",
      }),
    );

    expect(mocks.assertAssistantBelongsToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      "3",
    );
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        name: "Alice",
        assistantId: 3,
      }),
    );
    expect(response.status).toBe(201);
  });

  it("deriva a organização do utilizador e valida tags no update", async () => {
    const response = await usersRoute.PATCH(
      jsonRequest("http://localhost/api/users", {
        id: 11,
        assistantId: 3,
        tagIds: [5, "6", 5],
      }),
    );

    expect(mocks.requireOrgForUser).toHaveBeenCalledWith(11);
    expect(mocks.assertTagsBelongToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      [5, 6],
    );
    expect(mocks.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 11,
        assistantId: 3,
        tagIds: [5, 6],
      }),
    );
    expect(response.status).toBe(200);
  });

  it("usa apenas o id autorizado ao remover", async () => {
    const response = await usersRoute.DELETE({
      url: "http://localhost/api/users?id=11",
    });

    expect(mocks.requireOrgForUser).toHaveBeenCalledWith("11");
    expect(mocks.deleteUser).toHaveBeenCalledWith(11);
    expect(response.status).toBe(200);
  });
});

describe("operações em massa", () => {
  it("valida organização, utilizadores e assistente antes do bulk update", async () => {
    const response = await bulkRoute.PATCH(
      jsonRequest("http://localhost/api/users/bulk", {
        ids: [11, "12"],
        assistantId: "3",
        orgId: 7,
      }),
    );

    expect(mocks.requireOwnedOrg).toHaveBeenCalledWith(7);
    expect(mocks.assertUsersBelongToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      [11, 12],
    );
    expect(mocks.assertAssistantBelongsToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      "3",
    );
    expect(mocks.bulkSetAssistant).toHaveBeenCalledWith({
      userIds: [11, 12],
      assistantId: 3,
    });
    expect(response.status).toBe(200);
  });

  it("valida todos os utilizadores antes do bulk delete", async () => {
    const response = await bulkRoute.DELETE(
      jsonRequest("http://localhost/api/users/bulk", {
        ids: [11, 12],
        orgId: 7,
      }),
    );

    expect(mocks.assertUsersBelongToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      [11, 12],
    );
    expect(mocks.bulkDeleteUsers).toHaveBeenCalledWith({
      userIds: [11, 12],
    });
    expect(response.status).toBe(200);
  });

  it("valida utilizadores e tags antes da alteração de tags", async () => {
    const response = await bulkTagsPost(
      jsonRequest("http://localhost/api/users/bulk-tags", {
        ids: [11, 12],
        tagIds: [5, 6],
        op: "add",
        orgId: 7,
      }),
    );

    expect(mocks.assertUsersBelongToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      [11, 12],
    );
    expect(mocks.assertTagsBelongToOrg).toHaveBeenCalledWith(
      mocks.admin,
      7,
      [5, 6],
    );
    expect(mocks.bulkModifyTags).toHaveBeenCalledWith(mocks.admin, {
      userIds: [11, 12],
      tagIds: [5, 6],
      op: "add",
    });
    expect(response.status).toBe(200);
  });
});

describe("/api/users/import", () => {
  it("autoriza a organização antes de importar", async () => {
    const users = [{ name: "Alice", email: "alice@example.com" }];
    const response = await importUsersPost(
      jsonRequest("http://localhost/api/users/import", {
        organizationId: 7,
        users,
      }),
    );

    expect(mocks.requireOwnedOrg).toHaveBeenCalledWith(7);
    expect(mocks.importUsers).toHaveBeenCalledWith({ orgId: 7, users });
    expect(response.status).toBe(200);
  });
});

describe("/api/tags", () => {
  it("autoriza a organização antes de listar tags", async () => {
    const response = await tagsRoute.GET({
      url: "http://localhost/api/tags?orgId=7",
    });

    expect(mocks.requireOwnedOrg).toHaveBeenCalledWith("7");
    expect(mocks.getTagsInOrg).toHaveBeenCalledWith(mocks.admin, 7);
    expect(response.status).toBe(200);
  });

  it("deriva a organização da própria tag antes de a alterar", async () => {
    const response = await tagsRoute.PATCH(
      jsonRequest("http://localhost/api/tags", {
        id: 5,
        name: " Priority ",
      }),
    );

    expect(mocks.requireOrgForTag).toHaveBeenCalledWith(5);
    expect(mocks.updateTag).toHaveBeenCalledWith(mocks.admin, 5, {
      name: "Priority",
    });
    expect(response.status).toBe(200);
  });

  it("usa apenas o id autorizado ao remover uma tag", async () => {
    const response = await tagsRoute.DELETE({
      url: "http://localhost/api/tags?id=5",
    });

    expect(mocks.requireOrgForTag).toHaveBeenCalledWith("5");
    expect(mocks.deleteTag).toHaveBeenCalledWith(mocks.admin, 5);
    expect(response.status).toBe(200);
  });
});
