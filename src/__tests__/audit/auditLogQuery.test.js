import { describe, it, expect } from "vitest";

import {
  AUDIT_LOG_DEFAULT_PAGE_SIZE,
  AUDIT_LOG_MAX_PAGE_SIZE,
  parseAuditLogQuery,
} from "@/lib/audit/auditLogQuery";

describe("parseAuditLogQuery", () => {
  it("devolve os valores por omissão quando não há parâmetros", () => {
    expect(parseAuditLogQuery(new URLSearchParams())).toEqual({
      filters: {
        area: null,
        action: null,
        from: null,
        to: null,
        page: 1,
        pageSize: AUDIT_LOG_DEFAULT_PAGE_SIZE,
      },
    });
  });

  it("aceita um objeto simples além de URLSearchParams", () => {
    const { filters } = parseAuditLogQuery({ area: "user", page: "3" });

    expect(filters.area).toBe("user");
    expect(filters.page).toBe(3);
  });

  it("normaliza área e ação e converte datas para ISO", () => {
    const { filters } = parseAuditLogQuery(
      new URLSearchParams({
        area: " TAG ",
        action: "tag.created",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-30T23:59:59.999Z",
        page: "2",
        pageSize: "50",
      }),
    );

    expect(filters).toEqual({
      area: "tag",
      action: "tag.created",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T23:59:59.999Z",
      page: 2,
      pageSize: 50,
    });
  });

  it("recusa áreas e ações desconhecidas", () => {
    expect(parseAuditLogQuery({ area: "rockets" })).toEqual({
      error: "Invalid area",
    });

    expect(parseAuditLogQuery({ action: "user.exploded" })).toEqual({
      error: "Invalid action",
    });
  });

  it("recusa datas inválidas e intervalos ao contrário", () => {
    expect(parseAuditLogQuery({ from: "ontem" })).toEqual({
      error: "Invalid from date",
    });

    expect(
      parseAuditLogQuery({
        from: "2026-09-10T00:00:00.000Z",
        to: "2026-09-01T00:00:00.000Z",
      }),
    ).toEqual({ error: "from must be before to" });
  });

  it("recusa páginas e tamanhos fora dos limites", () => {
    expect(parseAuditLogQuery({ page: "0" })).toEqual({
      error: "Invalid page",
    });

    expect(parseAuditLogQuery({ page: "1.5" })).toEqual({
      error: "Invalid page",
    });

    expect(
      parseAuditLogQuery({ pageSize: String(AUDIT_LOG_MAX_PAGE_SIZE + 1) }),
    ).toEqual({ error: "Invalid pageSize" });
  });
});
