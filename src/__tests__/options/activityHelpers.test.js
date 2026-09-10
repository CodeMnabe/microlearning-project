import { describe, it, expect } from "vitest";

import {
  actionLabelKey,
  actorLabel,
  areaOfAction,
  buildAreaOptions,
  buildQueryString,
  dateInputToIso,
  detailEntries,
  entityLabel,
  totalPages,
} from "@/app/[locale]/(app)/options/helpers/activity.helpers";

const t = (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : key);

/**
 * Versão do tradutor com `has`, como o next-intl real, para testar
 * o recurso quando uma chave não existe.
 */
function translatorWith(knownKeys) {
  const fn = (key, vars) => t(key, vars);
  fn.has = (key) => knownKeys.includes(key);
  return fn;
}

const pairs = (entries) => entries.map((e) => [e.label, e.value]);

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

  it("calcula o número de páginas", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(25, 25)).toBe(1);
    expect(totalPages(26, 25)).toBe(2);
    expect(totalPages(60, 25)).toBe(3);
  });
});

describe("detailEntries", () => {
  it("devolve lista vazia sem detalhes", () => {
    expect(detailEntries({ details: null }, t)).toEqual([]);
    expect(detailEntries({}, t)).toEqual([]);
    expect(detailEntries({ details: ["x"] }, t)).toEqual([]);
  });

  it("descreve um envio com um par por linha e esconde chaves técnicas", () => {
    const entries = detailEntries(
      {
        details: {
          channel: "whatsapp",
          recipientCount: 12,
          ok: 10,
          failed: 2,
          hasTemplate: true,
          userIds: [1, 2],
        },
      },
      t,
    );

    expect(pairs(entries)).toEqual([
      ["Details.labels.channel", "Channels.whatsapp"],
      ["Details.labels.recipients", "12"],
      ["Details.labels.result", 'Details.sendSummary({"ok":10,"failed":2})'],
      ["Details.labels.withTemplate", "Details.yes"],
    ]);
  });

  it("traduz os nomes dos campos alterados e junta os repetidos", () => {
    const translation = translatorWith([
      "Details.fieldNames.name",
      "Details.fieldNames.phoneNumber",
      "Details.fieldNames.phoneNational",
    ]);

    const entries = detailEntries(
      {
        details: {
          fields: ["name", "phoneNumber", "phoneNational", "custom_thing"],
        },
      },
      translation,
    );

    expect(pairs(entries)).toEqual([
      [
        "Details.labels.fields",
        "Details.fieldNames.name, Details.fieldNames.phoneNumber, Details.fieldNames.phoneNational, custom_thing",
      ],
    ]);
  });

  it("descreve colaboradores criados e apagados", () => {
    expect(
      pairs(
        detailEntries(
          {
            details: {
              email: "ana@x.pt",
              phone: "+351912345678",
              assistantName: "Onboarding",
            },
          },
          t,
        ),
      ),
    ).toEqual([
      ["Details.labels.email", "ana@x.pt"],
      ["Details.labels.phone", "+351912345678"],
      ["Details.labels.assistant", "Onboarding"],
    ]);
  });

  it("descreve importações, operações em massa e tags", () => {
    expect(
      pairs(
        detailEntries(
          { details: { created: 3, updated: 1, failed: 0, skipped: 2 } },
          t,
        ),
      ),
    ).toEqual([
      [
        "Details.labels.result",
        'Details.importSummary({"created":3,"updated":1,"failed":0})',
      ],
    ]);

    expect(
      pairs(
        detailEntries(
          { details: { op: "set", userCount: 2, userIds: [1, 2], tagIds: [] } },
          t,
        ),
      ),
    ).toEqual([
      ["Details.labels.operation", "Details.tagOps.set"],
      ["Details.labels.count", "2"],
    ]);

    expect(pairs(detailEntries({ details: { color: "#abc" } }, t))).toEqual([
      ["Details.labels.color", "#abc"],
    ]);
  });

  it("descreve automações disparadas e envios agendados pelo sistema", () => {
    expect(
      pairs(
        detailEntries(
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
      ),
    ).toEqual([
      ["Details.labels.channel", "Channels.whatsapp"],
      ["Details.labels.trigger", "Details.triggers.user_inactive"],
      ["Details.labels.user", "Ana Silva"],
    ]);

    expect(
      pairs(
        detailEntries(
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
      ),
    ).toEqual([
      ["Details.labels.channel", "Channels.teams"],
      ["Details.labels.recipients", "5"],
      ["Details.labels.result", 'Details.sendSummary({"ok":5,"failed":0})'],
      ["Details.labels.status", "Details.statuses.sent"],
      ["Details.labels.source", "Details.sourceAutomation"],
    ]);
  });

  it("usa o valor cru quando não há tradução para o estado ou gatilho", () => {
    const translation = translatorWith([]);

    expect(
      pairs(
        detailEntries(
          { details: { status: "WEIRD", triggerType: "custom.thing" } },
          translation,
        ),
      ),
    ).toEqual([
      ["Details.labels.trigger", "custom.thing"],
      ["Details.labels.status", "WEIRD"],
    ]);
  });

  it("mostra definições da organização e chaves desconhecidas", () => {
    expect(
      pairs(
        detailEntries(
          {
            details: {
              setting: "read_chains_enabled",
              channel: "whatsapp",
              enabled: false,
              extra: "valor",
              flag: true,
              nested: { ignored: true },
            },
          },
          t,
        ),
      ),
    ).toEqual([
      ["Details.labels.channel", "Channels.whatsapp"],
      ["Details.labels.enabled", "Details.disabled"],
      ["extra", "valor"],
      ["flag", "Details.yes"],
    ]);
  });
});
