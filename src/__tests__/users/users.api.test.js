import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  bulkDeleteUsers,
  createUser,
  deleteUser,
  fetchAssistants,
  fetchTags,
  fetchThreadMessages,
  fetchUsers,
  importUsers,
  updateUser,
} from "@/app/[locale]/(app)/users/lib/users.api";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

/**
 * Constrói uma resposta com o mesmo contrato do `Response` nativo:
 * o corpo é lido através de `text()` e só pode ser lido uma vez.
 */
function makeResponse(body, { ok = true, status = ok ? 200 : 500 } = {}) {
  return Promise.resolve({
    ok,
    status,
    text: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pedidos de leitura", () => {
  it("fetchUsers constrói a query com paginação e devolve o corpo", async () => {
    mocks.fetch.mockReturnValue(
      makeResponse(JSON.stringify({ items: [{ id: 1 }], total: 1 })),
    );

    const data = await fetchUsers({ orgId: 7, page: 2, pageSize: 50 });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/users?orgId=7&page=2&pageSize=50",
    );
    expect(data).toEqual({ items: [{ id: 1 }], total: 1 });
  });

  it("fetchTags e fetchAssistants usam a organização recebida", async () => {
    mocks.fetch.mockReturnValue(makeResponse("[]"));

    await fetchTags(7);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/tags?orgId=7");

    await fetchAssistants(7);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/assistants?orgId=7");
  });

  it("codifica valores que precisam de escape no URL", async () => {
    mocks.fetch.mockReturnValue(makeResponse("{}"));

    await deleteUser("a b&c");

    expect(mocks.fetch).toHaveBeenCalledWith("/api/users?id=a%20b%26c", {
      method: "DELETE",
    });
  });
});

describe("pedidos de escrita", () => {
  it("createUser envia POST em JSON", async () => {
    mocks.fetch.mockReturnValue(makeResponse("{}"));

    await createUser({ name: "Alice" });

    expect(mocks.fetch).toHaveBeenCalledWith("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice" }),
    });
  });

  it("updateUser envia PATCH em JSON", async () => {
    mocks.fetch.mockReturnValue(makeResponse("{}"));

    await updateUser({ id: 1, assistantId: "a2" });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/users",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("bulkDeleteUsers envia DELETE com os ids", async () => {
    mocks.fetch.mockReturnValue(makeResponse("{}"));

    await bulkDeleteUsers({ ids: ["u1", "u2"], orgId: 7 });

    expect(mocks.fetch).toHaveBeenCalledWith("/api/users/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["u1", "u2"], orgId: 7 }),
    });
  });

  it("importUsers traduz orgId para organizationId", async () => {
    mocks.fetch.mockReturnValue(makeResponse("{}"));

    await importUsers({ orgId: 7, users: [{ name: "Alice" }] });

    const [, options] = mocks.fetch.mock.calls[0];

    expect(JSON.parse(options.body)).toEqual({
      organizationId: 7,
      users: [{ name: "Alice" }],
    });
  });
});

describe("tratamento de erros", () => {
  it("lança a mensagem do campo error quando existe", async () => {
    mocks.fetch.mockReturnValue(
      makeResponse(JSON.stringify({ error: "Missing orgId" }), { ok: false }),
    );

    await expect(fetchTags(7)).rejects.toThrow("Missing orgId");
  });

  it("lança o corpo em texto quando não é JSON", async () => {
    mocks.fetch.mockReturnValue(
      makeResponse("<html>erro do servidor</html>", { ok: false }),
    );

    await expect(fetchTags(7)).rejects.toThrow("<html>erro do servidor</html>");
  });

  it("lança o código de estado quando o corpo está vazio", async () => {
    mocks.fetch.mockReturnValue(makeResponse("", { ok: false, status: 503 }));

    await expect(fetchTags(7)).rejects.toThrow("Request failed (503)");
  });

  it("devolve null quando a resposta tem sucesso e corpo vazio", async () => {
    mocks.fetch.mockReturnValue(makeResponse("", { ok: true, status: 204 }));

    await expect(fetchTags(7)).resolves.toBeNull();
  });

  it("devolve null quando o corpo não é JSON válido", async () => {
    mocks.fetch.mockReturnValue(makeResponse("nao é json"));

    await expect(fetchTags(7)).resolves.toBeNull();
  });
});

describe("fetchThreadMessages", () => {
  it("usa a rota principal quando responde com sucesso", async () => {
    mocks.fetch.mockReturnValue(
      makeResponse(JSON.stringify({ messages: [{ id: 1 }] })),
    );

    const data = await fetchThreadMessages(42);

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/messages?threadId=42");
    expect(data).toEqual({ messages: [{ id: 1 }] });
  });

  it("recorre à rota alternativa quando a principal falha", async () => {
    mocks.fetch
      .mockReturnValueOnce(makeResponse("", { ok: false, status: 404 }))
      .mockReturnValueOnce(makeResponse(JSON.stringify({ messages: [] })));

    const data = await fetchThreadMessages(42);

    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/messages?threadId=42",
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/threads/42/messages",
    );
    expect(data).toEqual({ messages: [] });
  });

  it("propaga o erro quando as duas rotas falham", async () => {
    mocks.fetch.mockReturnValue(makeResponse("", { ok: false, status: 500 }));

    await expect(fetchThreadMessages(42)).rejects.toThrow(
      "Request failed (500)",
    );
  });
});
