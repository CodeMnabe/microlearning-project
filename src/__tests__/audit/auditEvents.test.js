import { describe, it, expect } from "vitest";

import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LIST,
  auditAreaFromAction,
  buildAuditRow,
  isKnownAuditAction,
  providedFields,
} from "@/lib/audit/auditEvents";

const actor = {
  type: "user",
  userId: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.com",
};

describe("catálogo de ações", () => {
  it("todas as ações têm o formato entidade.verbo", () => {
    for (const action of AUDIT_ACTION_LIST) {
      expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it("não há ações duplicadas", () => {
    expect(new Set(AUDIT_ACTION_LIST).size).toBe(AUDIT_ACTION_LIST.length);
  });

  it("reconhece ações conhecidas e rejeita as outras", () => {
    expect(isKnownAuditAction(AUDIT_ACTIONS.USER_CREATED)).toBe(true);
    expect(isKnownAuditAction("user.exploded")).toBe(false);
    expect(isKnownAuditAction(null)).toBe(false);
  });

  it("extrai a área a partir da ação", () => {
    expect(auditAreaFromAction("broadcast.sent")).toBe("broadcast");
    expect(auditAreaFromAction("semponto")).toBeNull();
    expect(auditAreaFromAction(undefined)).toBeNull();
  });
});

describe("providedFields", () => {
  it("devolve só os campos que vieram definidos", () => {
    expect(
      providedFields({ name: "Ana", email: undefined, phone: null }),
    ).toEqual(["name", "phone"]);
  });

  it("devolve lista vazia para entradas que não são objetos", () => {
    expect(providedFields(null)).toEqual([]);
    expect(providedFields(["a"])).toEqual([]);
  });
});

describe("buildAuditRow", () => {
  it("constrói a linha completa no formato da tabela", () => {
    const row = buildAuditRow({
      organizationId: "7",
      actor,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityId: 42,
      entityLabel: "  Ana Silva  ",
      details: { fields: ["name"], skip: undefined },
    });

    expect(row).toEqual({
      organization_id: 7,
      actor_type: "user",
      actor_user_id: actor.userId,
      actor_email: actor.email,
      action: "user.created",
      entity_type: "user",
      entity_id: "42",
      entity_label: "Ana Silva",
      details: { fields: ["name"] },
    });
  });

  it("usa o tipo de elemento indicado quando difere do prefixo da ação", () => {
    const row = buildAuditRow({
      organizationId: 1,
      actor,
      action: AUDIT_ACTIONS.MESSAGE_TEMPLATE_SENT,
      entityType: "user",
      entityId: 3,
    });

    expect(row.entity_type).toBe("user");
  });

  it("aceita elementos sem id nem nome e detalhes em falta", () => {
    const row = buildAuditRow({
      organizationId: 1,
      actor,
      action: AUDIT_ACTIONS.USER_IMPORTED,
    });

    expect(row.entity_id).toBeNull();
    expect(row.entity_label).toBeNull();
    expect(row.details).toEqual({});
  });

  it("corta nomes demasiado longos", () => {
    const row = buildAuditRow({
      organizationId: 1,
      actor,
      action: AUDIT_ACTIONS.TAG_CREATED,
      entityLabel: "x".repeat(500),
    });

    expect(row.entity_label.length).toBe(200);
    expect(row.entity_label.endsWith("…")).toBe(true);
  });

  it("ignora detalhes que não sejam um objeto simples", () => {
    const row = buildAuditRow({
      organizationId: 1,
      actor,
      action: AUDIT_ACTIONS.TAG_CREATED,
      details: ["não", "é", "objeto"],
    });

    expect(row.details).toEqual({});
  });

  it("aceita um ator de sistema sem utilizador", () => {
    const row = buildAuditRow({
      organizationId: 1,
      actor: { type: "system" },
      action: AUDIT_ACTIONS.BROADCAST_SENT,
    });

    expect(row.actor_type).toBe("system");
    expect(row.actor_user_id).toBeNull();
    expect(row.actor_email).toBeNull();
  });

  it("recusa organização inválida", () => {
    expect(() =>
      buildAuditRow({
        organizationId: "abc",
        actor,
        action: AUDIT_ACTIONS.USER_CREATED,
      }),
    ).toThrow(/organizationId/);
  });

  it("recusa ações desconhecidas", () => {
    expect(() =>
      buildAuditRow({
        organizationId: 1,
        actor,
        action: "user.exploded",
      }),
    ).toThrow(/Unknown audit action/);
  });

  it("recusa ator utilizador sem id", () => {
    expect(() =>
      buildAuditRow({
        organizationId: 1,
        actor: { type: "user", email: "x@y.z" },
        action: AUDIT_ACTIONS.USER_CREATED,
      }),
    ).toThrow(/userId/);
  });
});
