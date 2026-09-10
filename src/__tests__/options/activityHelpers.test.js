import { describe, it, expect } from "vitest";

import {
  actionLabelKey,
  actorLabel,
  areaOfAction,
  buildAreaOptions,
  buildQueryString,
  dateInputToIso,
  describeDetails,
  entityLabel,
  totalPages,
} from "@/app/[locale]/(app)/options/helpers/activity.helpers";

const t = (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : key);

describe("helpers do histórico de atividade", () => {
  it("constrói as opções de área com 'todas' em primeiro", () => {
    const options = buildAreaOptions(t);

    expect(options[0]).toEqual({ value: "all", label: "Areas.all" });
    expect(options.map((o) => o.value)).toContain("user");
    expect(options.map((o) => o.value)).toContain("organization");
  });

  it("traduz a ação para uma chave sem pontos", () => {
    expect(actionLabelKey("user.created")).toBe("Actions.user_created");
    expect(actionLabelKey(null)).toBe("Actions.unknown");
  });

  it("extrai a área da ação", () => {
    expect(areaOfAction("broadcast.sent")).toBe("broadcast");
    expect(areaOfAction("")).toBeNull();
  });

  it("converte a data do input no início e no fim do dia local", () => {
    const start = new Date(dateInputToIso("2026-09-10", "start"));
    const end = new Date(dateInputToIso("2026-09-10", "end"));

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getTime()).toBeGreaterThan(start.getTime());

    expect(dateInputToIso("10/09/2026")).toBeNull();
    expect(dateInputToIso("")).toBeNull();
  });

  it("monta a query string só com os filtros ativos", () => {
    const params = new URLSearchParams(
      buildQueryString({ orgId: 7, area: "all", from: "", to: "", page: 2 }),
    );

    expect(params.get("orgId")).toBe("7");
    expect(params.has("area")).toBe(false);
    expect(params.has("from")).toBe(false);
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("25");

    const filtered = new URLSearchParams(
      buildQueryString({
        orgId: 7,
        area: "tag",
        from: "2026-09-01",
        to: "",
        page: 1,
      }),
    );

    expect(filtered.get("area")).toBe("tag");
    expect(filtered.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(filtered.has("to")).toBe(false);
  });

  it("mostra o autor como sistema, email ou desconhecido", () => {
    expect(actorLabel({ actor_type: "system" }, t)).toBe("Actor.system");
    expect(actorLabel({ actor_type: "user", actor_email: "a@b.pt" }, t)).toBe(
      "a@b.pt",
    );
    expect(actorLabel({ actor_type: "user" }, t)).toBe("Actor.unknown");
  });

  it("mostra o nome do elemento ou o id como recurso", () => {
    expect(entityLabel({ entity_label: "Ana" })).toBe("Ana");
    expect(entityLabel({ entity_id: "42" })).toBe("#42");
    expect(entityLabel({})).toBe("-");
  });

  it("resume os detalhes conhecidos e ignora os restantes", () => {
    const parts = describeDetails(
      {
        details: {
          channel: "whatsapp",
          recipientCount: 12,
          ok: 10,
          failed: 2,
          hasTemplate: true,
          somethingElse: "ignored",
        },
      },
      t,
    );

    expect(parts).toEqual([
      "Channels.whatsapp",
      'Details.recipients({"count":12})',
      'Details.result({"ok":10,"failed":2})',
    ]);
  });

  it("descreve campos alterados, importações e definições", () => {
    expect(
      describeDetails({ details: { fields: ["name", "email"] } }, t),
    ).toEqual(['Details.fields({"count":2,"list":"name, email"})']);

    expect(
      describeDetails({ details: { created: 3, updated: 1, failed: 0 } }, t),
    ).toEqual(['Details.imported({"created":3,"updated":1,"failed":0})']);

    expect(
      describeDetails(
        { details: { setting: "read_chains_enabled", enabled: false } },
        t,
      ),
    ).toEqual(["Details.disabled"]);

    expect(
      describeDetails({ details: { op: "set", userCount: 2 } }, t),
    ).toEqual(["Details.tagOps.set"]);
  });

  it("descreve automações disparadas e envios agendados pelo sistema", () => {
    expect(
      describeDetails(
        {
          details: {
            triggerType: "user.inactive",
            channel: "whatsapp",
            userId: 42,
            userName: "Ana Silva",
          },
        },
        t,
      ),
    ).toEqual([
      "Channels.whatsapp",
      "Details.triggers.user_inactive",
      'Details.user({"name":"Ana Silva"})',
    ]);

    expect(
      describeDetails(
        {
          details: {
            channel: "teams",
            recipientCount: 5,
            ok: 5,
            failed: 0,
            status: "sent",
            automation: true,
          },
        },
        t,
      ),
    ).toEqual([
      "Channels.teams",
      'Details.recipients({"count":5})',
      'Details.result({"ok":5,"failed":0})',
      'Details.status({"status":"sent"})',
      "Details.automation",
    ]);
  });

  it("devolve lista vazia sem detalhes", () => {
    expect(describeDetails({ details: null }, t)).toEqual([]);
    expect(describeDetails({}, t)).toEqual([]);
  });

  it("calcula o número de páginas", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(25, 25)).toBe(1);
    expect(totalPages(26, 25)).toBe(2);
    expect(totalPages(60, 25)).toBe(3);
  });
});
