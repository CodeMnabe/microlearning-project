import { describe, it, expect } from "vitest";

import {
  buildAssistantsById,
  calculateUsersTotalPages,
  filterUsers,
  getUserInitial,
  normalizeUsers,
  stripPhoneCountryCode,
} from "@/app/[locale]/(app)/users/lib/users.helpers";

describe("getUserInitial", () => {
  it("devolve a primeira letra em maiúscula", () => {
    expect(getUserInitial("alice")).toBe("A");
  });

  it("ignora espaços no início", () => {
    expect(getUserInitial("  bob")).toBe("B");
  });

  it("devolve ? quando o nome está vazio", () => {
    expect(getUserInitial("")).toBe("?");
    expect(getUserInitial("   ")).toBe("?");
    expect(getUserInitial()).toBe("?");
  });
});

describe("normalizeUsers", () => {
  it("converte os campos da API para o formato da interface", () => {
    const [user] = normalizeUsers([
      {
        id: 1,
        name: "Alice",
        phone_number: "+351912345678",
        phone_country_code: "+351",
        phone_national: "912345678",
        email: "alice@example.com",
        tag_names: ["IT"],
        tag_ids: [10],
        assistant_id: 5,
        teams_aad_object_id: "aad-1",
        teams_from_id: "29:abc",
        assistantName: "Assistant One",
        organization_id: 3,
      },
    ]);

    expect(user).toEqual({
      id: 1,
      name: "Alice",
      phone: "+351912345678",
      phoneCountryCode: "+351",
      phoneNational: "912345678",
      email: "alice@example.com",
      tags: ["IT"],
      tagIds: [10],
      assistantId: 5,
      teamsAadObjectId: "aad-1",
      teamsFromId: "29:abc",
      assistantName: "Assistant One",
      organization_id: 3,
    });
  });

  it("usa a lista de tags quando não existem tag_names nem tag_ids", () => {
    const [user] = normalizeUsers([
      {
        id: 2,
        name: "Bob",
        tags: [
          { id: 7, name: "HR" },
          { id: 8, name: "Ops" },
        ],
      },
    ]);

    expect(user.tags).toEqual(["HR", "Ops"]);
    expect(user.tagIds).toEqual([7, 8]);
  });

  it("aplica os valores por omissão quando os campos faltam", () => {
    const [user] = normalizeUsers([{ id: 3, name: "Carol" }]);

    expect(user.phone).toBe("");
    expect(user.email).toBe("");
    expect(user.assistantId).toBeNull();
    expect(user.assistantName).toBe("—");
  });

  it("devolve uma lista vazia quando não recebe utilizadores", () => {
    expect(normalizeUsers()).toEqual([]);
  });
});

describe("filterUsers", () => {
  const USERS = [
    {
      id: 1,
      name: "Alice",
      phone: "+351912345678",
      phoneCountryCode: "+351",
      phoneNational: "912345678",
      email: "alice@example.com",
      tagIds: [1, 2],
      assistantId: "a1",
    },
    {
      id: 2,
      name: "Bob",
      phone: "",
      phoneCountryCode: "+34",
      phoneNational: "600111222",
      email: "bob@example.com",
      tagIds: [2],
      assistantId: "a2",
    },
  ];

  it("devolve todos os utilizadores sem pesquisa nem filtros", () => {
    expect(filterUsers(USERS, "", [], [])).toHaveLength(2);
  });

  it("pesquisa por nome, ignorando maiúsculas", () => {
    const result = filterUsers(USERS, "ALICE", [], []);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("pesquisa por email e por telefone", () => {
    expect(filterUsers(USERS, "bob@example", [], [])).toHaveLength(1);
    expect(filterUsers(USERS, "600111", [], [])).toHaveLength(1);
  });

  it("aplica o filtro de tags com lógica AND", () => {
    // A tag 2 existe nos dois utilizadores.
    expect(filterUsers(USERS, "", [2], [])).toHaveLength(2);

    // Só a Alice tem as tags 1 e 2 ao mesmo tempo.
    const result = filterUsers(USERS, "", [1, 2], []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("aplica o filtro de assistentes com lógica OR", () => {
    expect(filterUsers(USERS, "", [], ["a1", "a2"])).toHaveLength(2);

    const result = filterUsers(USERS, "", [], ["a2"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Bob");
  });

  it("combina pesquisa e filtros", () => {
    expect(filterUsers(USERS, "alice", [], ["a2"])).toHaveLength(0);
  });
});

describe("buildAssistantsById", () => {
  it("indexa os assistentes por id convertido em string", () => {
    const map = buildAssistantsById([
      { id: 1, name: "One" },
      { id: 2, name: "Two" },
    ]);

    expect(map.get("1").name).toBe("One");
    expect(map.get("2").name).toBe("Two");
  });

  it("devolve um mapa vazio sem assistentes", () => {
    expect(buildAssistantsById().size).toBe(0);
  });
});

describe("calculateUsersTotalPages", () => {
  it("arredonda para cima", () => {
    expect(calculateUsersTotalPages(101, 50)).toBe(3);
    expect(calculateUsersTotalPages(100, 50)).toBe(2);
  });

  it("devolve sempre pelo menos uma página", () => {
    expect(calculateUsersTotalPages(0, 50)).toBe(1);
  });
});

describe("stripPhoneCountryCode", () => {
  it("remove o prefixo quando corresponde", () => {
    expect(stripPhoneCountryCode("+351912345678", "+351")).toBe("912345678");
  });

  it("remove apenas o + quando o prefixo não corresponde", () => {
    expect(stripPhoneCountryCode("+34600111222", "+351")).toBe("34600111222");
  });

  it("devolve string vazia sem número", () => {
    expect(stripPhoneCountryCode("", "+351")).toBe("");
    expect(stripPhoneCountryCode(null, "+351")).toBe("");
  });
});
