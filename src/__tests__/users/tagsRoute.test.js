import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/repos/tag.repo.js", () => ({
  getTagsInOrg: vi.fn(),
  createTag: mocks.createTag,
  updateTag: mocks.updateTag,
  deleteTag: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  cleanPatch: (fields) => fields,
  handleApiError: () => Response.json({ error: "failed" }, { status: 500 }),
  requireOwnedOrg: async () => ({ admin: {}, orgId: 1 }),
  requireOrgForTag: async () => ({ admin: {}, tagId: 7 }),
}));

import { PATCH, POST } from "@/app/api/tags/route";

const duplicate = Object.assign(new Error("duplicate key value"), {
  code: "23505",
});

function request(method, body) {
  return new Request("http://localhost/api/tags", {
    method,
    body: JSON.stringify(body),
  });
}

describe("/api/tags com nome repetido", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 409 ao criar uma tag com nome que já existe", async () => {
    mocks.createTag.mockRejectedValueOnce(duplicate);

    const res = await POST(request("POST", { orgId: 1, name: "Grupo 1" }));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("tag_name_taken");
  });

  it("responde 409 ao renomear para um nome que já existe", async () => {
    mocks.updateTag.mockRejectedValueOnce(duplicate);

    const res = await PATCH(request("PATCH", { id: 7, name: "Grupo 1" }));

    expect(res.status).toBe(409);
  });

  it("mantém o 500 nos outros erros", async () => {
    mocks.createTag.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(request("POST", { orgId: 1, name: "Grupo 9" }));

    expect(res.status).toBe(500);
  });
});
