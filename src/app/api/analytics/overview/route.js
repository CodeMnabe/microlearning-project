
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com Service Role.
 * Esta rota corre no servidor e pode consultar métricas globais da organização.
 * A SUPABASE_SERVICE_ROLE_KEY nunca deve ser exposta no frontend.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Conta linhas de uma tabela Supabase.
 * Usando quando só precisamos do total, sem carregar os dados completos.
 */
async function countRows(table, applyFilters) {
  let query = supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Vai buscar linhas específicas de uma tabela Supabase.
 * Usado quando precisamos analisar campos ou construir gráficos/rankings.
 */
async function fetchRows(table, columns, applyFilters) {
  let query = supabaseAdmin.from(table).select(columns);

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Verifica se um valor está preenchido.
 * Evita contar valores nulos, undefined ou strings vazias.
 */
function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * Soma valores numéricos de uma lista.
 * Usado para somar recipient_count nas mensagens agendadas.
 */
function sumNumbers(items, key) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[key] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/**
 * Períodos aceites pelo filtro da dashboard.
 */
const VALID_PERIODS = new Set(["all", "7d", "30d", "90d"]);

/**
 * Converte o período escolhido numa data inicial.
 * Exemplo: "30d" devolve a data de há 30 dias.
 */
function getPeriodStart(period) {
  if (!VALID_PERIODS.has(period)) {
    return {
      valid: false,
      startDate: null,
    };
  }

  if (period === "all") {
    return {
      valid: true,
      startDate: null,
    };
  }

  const days = Number(period.replace("d", ""));
  const date = new Date();

  date.setDate(date.getDate() - days);

  return {
    valid: true,
    startDate: date.toISOString(),
  };
}

/**
 * Aplica o filtro de período a uma query Supabase.
 * Por defeito usa a coluna created_at.
 */
function applyPeriod(query, periodStart, dateColumn = "created_at") {
  if (!periodStart) return query;

  return query.gte(dateColumn, periodStart);
}

/**
 * Converte uma data para o formato YYYY-MM-DD.
 * Usado para agrupar dados por dia nos gráficos.
 */
function getDayKey(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

/**
 * Cria uma lista de dias entre duas datas.
 * Garante que os gráficos têm todos os dias, mesmo com valor zero.
 */
function getDayRange(startDate, endDate = new Date()) {
  const days = [];

  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

/**
 * Constrói uma série diária para os gráficos.
 * Conta quantos registos existem em cada dia.
 */
function buildDailySeries(startDate, rows, dateColumn, valueKey) {
  const countsByDay = Object.fromEntries(
    getDayRange(startDate).map((day) => [day, 0])
  );

  rows.forEach((row) => {
    const day = getDayKey(row?.[dateColumn]);

    if (day && day in countsByDay) {
      countsByDay[day] += 1;
    }
  });

  return Object.entries(countsByDay).map(([date, value]) => ({
    date,
    [valueKey]: value,
  }));
}

/**
 * Converte valores para número de forma segura.
 * Usado em cálculos e rankings.
 */
function safeNumberForApi(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Ordena uma lista por uma métrica e devolve apenas os primeiros resultados.
 * Usado para rankings.
 */
function sortAndLimit(items, key, limit = 5) {
  return [...items]
    .sort((a, b) => safeNumberForApi(b[key]) - safeNumberForApi(a[key]))
    .slice(0, limit);
}



/**
 * Executa uma métrica opcional com fallback.
 * Se falhar, evita que a API inteira devolva erro 500.
 */
async function withMetricFallback(label, promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    console.warn(`[analytics] ${label} failed:`, err);
    return fallback;
  }
}

/**
 * Calcula métricas de links rastreados.
 * A tabela tracked_link_event não tem org_id diretamente.
 * Por isso primeiro buscamos os links da organização e depois os cliques desses links.
 */
async function getTrackedLinkMetrics(orgId, periodStart) {
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return {
      totalLinks: 0,
      totalClicks: 0,
    };
  }

  const totalClicks = await countRows("tracked_link_event", (q) =>
    applyPeriod(
      q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
      periodStart
    )
  );

  return {
    totalLinks: trackedLinkIds.length,
    totalClicks,
  };
}

/**
 * Vai buscar eventos de clique para construir o gráfico diário de cliques.
 */
async function getTrackedLinkClickRows(orgId, trendStart) {
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return [];
  }

  return fetchRows("tracked_link_event", "created_at", (q) =>
    applyPeriod(
      q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
      trendStart
    )
  );
}

/**
 * Cria o ranking dos links mais clicados no período selecionado.
 */
async function getTopTrackedLinks(orgId, periodStart) {
  const trackedLinks = await fetchRows(
    "tracked_link",
    "id, link_label, destination_url",
    (q) => q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return [];
  }

  const clickEvents = await fetchRows(
    "tracked_link_event",
    "tracked_link_id, created_at",
    (q) =>
      applyPeriod(
        q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds),
        periodStart
      )
  );

  const clicksByLinkId = clickEvents.reduce((acc, event) => {
    const linkId = event.tracked_link_id;

    if (!linkId) return acc;

    acc[linkId] = (acc[linkId] || 0) + 1;

    return acc;
  }, {});

  const ranking = trackedLinks.map((link) => ({
    id: link.id,
    label: link.link_label || link.destination_url || "Link",
    destinationUrl: link.destination_url,
    clicks: clicksByLinkId[link.id] || 0,
  }));

  return sortAndLimit(
    ranking.filter((item) => item.clicks > 0),
    "clicks",
    10
  );
}

/**
 * Cria o ranking das automações com mais falhas no período selecionado.
 */
async function getTopAutomationFailures(orgId, periodStart) {
  const failedRuns = await fetchRows(
    "automation_run",
    "rule_id, last_error, created_at",
    (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("last_error", "is", null),
        periodStart
      )
  );

  if (failedRuns.length === 0) {
    return [];
  }

  const rules = await fetchRows("automation_rule", "id, name", (q) =>
    q.eq("organization_id", orgId)
  );

  const ruleNameById = rules.reduce((acc, rule) => {
    acc[rule.id] = rule.name;
    return acc;
  }, {});

  const failuresByRuleId = failedRuns.reduce((acc, run) => {
    const ruleId = run.rule_id || "unknown";

    if (!acc[ruleId]) {
      acc[ruleId] = {
        id: ruleId,
        name: ruleNameById[ruleId] || "Unknown automation",
        failures: 0,
        lastError: "",
      };
    }

    acc[ruleId].failures += 1;

    if (run.last_error) {
      acc[ruleId].lastError = run.last_error;
    }

    return acc;
  }, {});

  return sortAndLimit(Object.values(failuresByRuleId), "failures");
}

/**
 * Endpoint principal das métricas.
 * Recebe orgId e period, calcula os dados e devolve tudo para a dashboard.
 */
export async function GET(req) {
  try {
    // Lê os parâmetros recebidos na URL.
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));
    const period = searchParams.get("period") || "all";

    // Calcula o período usado nas métricas gerais.
    const { valid: isValidPeriod, startDate: periodStart } =
      getPeriodStart(period);

    // Quando o período é "all", gráficos e rankings usam os últimos 110d dias.
    const { startDate: defaultTrendStart } = getPeriodStart("90d");
    const trendStart = periodStart || defaultTrendStart;
    const rankingStart = periodStart;

    // Valida se a organização foi enviada corretamente.
    if (!orgId || Number.isNaN(orgId)) {
      return NextResponse.json(
        { error: "Missing or invalid orgId" },
        { status: 400 }
      );
    }

    // Valida se o período recebido é permitido.
    if (!isValidPeriod) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    /**
     * Executa as métricas principais em paralelo.
     * Isto melhora a performance porque as queries não correm uma a uma.
     */
    const [
      users,
      assistantsTotal,
      assistantsWithoutOpenAiId,
      templatesTotal,
      templatesActive,
      templatesPending,
      templatesRejected,
      messagesTotal,
      whatsappMessages,
      teamsMessages,
      userMessages,
      assistantMessages,
      deliveredMessages,
      readMessages,
      failedMessages,
      automationRulesTotal,
      automationRulesActive,
      automationRunsTotal,
      automationRunsProcessed,
      automationRunsFailed,
      scheduledBroadcastRows,
      pendingOutreachTotal,
      pendingOutreachActive,
      trackedLinks,
    ] = await Promise.all([
      fetchRows(
        "user",
        `
          id,
          assistant_id,
          email,
          phone_number,
          phone_country_code,
          phone_national,
          teams_aad_object_id,
          teams_from_id,
          whatsapp_bsuid,
          bird_contact_id
        `,
        (q) => q.eq("organization_id", orgId)
      ),

      countRows("assistant", (q) => q.eq("organization_id", orgId)),

      countRows("assistant", (q) =>
        q.eq("organization_id", orgId).or("open_ai_id.is.null,open_ai_id.eq.")
      ),

      countRows("whatsapp_templates", (q) =>
        q.or(`org_id.eq.${orgId},org_id.is.null`)
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["ACTIVE", "active", "APPROVED", "approved"])
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", [
            "PENDING",
            "pending",
            "NEW",
            "new",
            "DRAFT",
            "draft",
            "PENDINGREVIEW",
            "pendingreview",
          ])
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["REJECTED", "rejected", "INACTIVE", "inactive"])
      ),

      countRows("message", (q) =>
        applyPeriod(q.eq("organization_id", orgId), periodStart)
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("channel", "whatsapp"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("channel", "teams"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("role", "user"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).eq("role", "assistant"),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("delivered_at", "is", null),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("read_at", "is", null),
          periodStart
        )
      ),

      countRows("message", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("failed_at", "is", null),
          periodStart
        )
      ),

      countRows("automation_rule", (q) => q.eq("organization_id", orgId)),

      countRows("automation_rule", (q) =>
        q.eq("organization_id", orgId).eq("is_active", true)
      ),

      countRows("automation_run", (q) =>
        applyPeriod(q.eq("organization_id", orgId), periodStart)
      ),

      countRows("automation_run", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("processed_at", "is", null),
          periodStart
        )
      ),

      countRows("automation_run", (q) =>
        applyPeriod(
          q.eq("organization_id", orgId).not("last_error", "is", null),
          periodStart
        )
      ),

      fetchRows(
        "scheduled_broadcast",
        "id, status, channel, recipient_count",
        (q) =>
          applyPeriod(
            q.eq("organization_id", orgId),
            periodStart,
            "scheduled_for"
          )
      ),

      countRows("pending_outreach", (q) =>
        applyPeriod(q.eq("org_id", orgId), periodStart)
      ),

      countRows("pending_outreach", (q) =>
        applyPeriod(
          q.eq("org_id", orgId).in("status", ["pending", "queued", "active"]),
          periodStart
        )
      ),

      withMetricFallback(
        "tracked link metrics",
        getTrackedLinkMetrics(orgId, periodStart),
        {
          totalLinks: 0,
          totalClicks: 0,
        }
      ),
    ]);

    /**
     * Vai buscar dados usados nos gráficos de evolução diária.
     * Estas métricas têm fallback para não quebrar a dashboard toda.
     */
    const [
      dailyMessageRows,
      dailyFailedMessageRows,
      dailyAutomationProcessedRows,
      dailyClickRows,
    ] = await Promise.all([
      withMetricFallback(
        "daily message rows",
        fetchRows("message", "created_at", (q) =>
          applyPeriod(q.eq("organization_id", orgId), trendStart)
        ),
        []
      ),

      withMetricFallback(
        "daily failed message rows",
        fetchRows("message", "failed_at", (q) =>
          applyPeriod(
            q.eq("organization_id", orgId).not("failed_at", "is", null),
            trendStart,
            "failed_at"
          )
        ),
        []
      ),

      withMetricFallback(
        "daily automation processed rows",
        fetchRows("automation_run", "processed_at", (q) =>
          applyPeriod(
            q.eq("organization_id", orgId).not("processed_at", "is", null),
            trendStart,
            "processed_at"
          )
        ),
        []
      ),

      withMetricFallback(
        "daily click rows",
        getTrackedLinkClickRows(orgId, trendStart),
        []
      ),
    ]);

    /**
     * Vai buscar rankings principais da dashboard.
     * Também usam fallback porque são métricas complementares.
     */
    const [topTrackedLinks, topAutomationFailures] = await Promise.all([
      withMetricFallback(
        "top tracked links",
        getTopTrackedLinks(orgId, rankingStart),
        []
      ),

      withMetricFallback(
        "top automation failures",
        getTopAutomationFailures(orgId, rankingStart),
        []
      ),
    ]);

    /**
     * Calcula métricas derivadas dos utilizadores.
     */
    const totalUsers = users.length;

    const usersWithAssistant = users.filter((user) =>
      hasValue(user.assistant_id)
    ).length;

    const usersWithEmail = users.filter((user) => hasValue(user.email)).length;

    const usersWithPhone = users.filter(
      (user) =>
        hasValue(user.phone_number) ||
        (hasValue(user.phone_country_code) && hasValue(user.phone_national))
    ).length;

    const usersWithTeams = users.filter(
      (user) =>
        hasValue(user.teams_aad_object_id) || hasValue(user.teams_from_id)
    ).length;

    const usersWithWhatsapp = users.filter(
      (user) =>
        hasValue(user.whatsapp_bsuid) ||
        hasValue(user.bird_contact_id) ||
        hasValue(user.phone_number)
    ).length;

    /**
     * Calcula métricas derivadas das mensagens agendadas.
     * Aceita vários nomes de status para ser mais flexível.
     */
    const scheduledBroadcastsTotal = scheduledBroadcastRows.length;

    const scheduledBroadcastsQueued = scheduledBroadcastRows.filter((item) =>
      ["queued", "pending", "scheduled"].includes(
        String(item.status || "").toLowerCase()
      )
    ).length;

    const scheduledBroadcastsCompleted = scheduledBroadcastRows.filter((item) =>
      ["completed", "sent", "done"].includes(
        String(item.status || "").toLowerCase()
      )
    ).length;

    const scheduledBroadcastsFailed = scheduledBroadcastRows.filter((item) =>
      ["failed", "error"].includes(String(item.status || "").toLowerCase())
    ).length;

    const scheduledBroadcastRecipients = sumNumbers(
      scheduledBroadcastRows,
      "recipient_count"
    );

    /**
     * Constrói séries diárias para os gráficos de linha.
     */
    const dailyMessages = buildDailySeries(
      trendStart,
      dailyMessageRows,
      "created_at",
      "messages"
    );

    const dailyFailedMessages = buildDailySeries(
      trendStart,
      dailyFailedMessageRows,
      "failed_at",
      "failures"
    );

    const dailyAutomationRuns = buildDailySeries(
      trendStart,
      dailyAutomationProcessedRows,
      "processed_at",
      "processed"
    );

    const dailyClicks = buildDailySeries(
      trendStart,
      dailyClickRows,
      "created_at",
      "clicks"
    );

    /**
     * Devolve todos os dados organizados para o frontend.
     */
    return NextResponse.json({
      ok: true,

      period: {
        value: period,
        startDate: periodStart,
      },

      users: {
        total: totalUsers,
        withAssistant: usersWithAssistant,
        withoutAssistant: Math.max(0, totalUsers - usersWithAssistant),
        withEmail: usersWithEmail,
        withPhone: usersWithPhone,
        withTeams: usersWithTeams,
        withWhatsapp: usersWithWhatsapp,
      },

      assistants: {
        total: assistantsTotal,
        withoutOpenAiId: assistantsWithoutOpenAiId,
      },

      templates: {
        total: templatesTotal,
        active: templatesActive,
        pending: templatesPending,
        rejected: templatesRejected,
      },

      messages: {
        total: messagesTotal,
        whatsapp: whatsappMessages,
        teams: teamsMessages,
        userMessages,
        assistantMessages,
        delivered: deliveredMessages,
        read: readMessages,
        failed: failedMessages,
      },

      automations: {
        rulesTotal: automationRulesTotal,
        rulesActive: automationRulesActive,
        rulesPaused: Math.max(0, automationRulesTotal - automationRulesActive),
        runsTotal: automationRunsTotal,
        runsProcessed: automationRunsProcessed,
        runsFailed: automationRunsFailed,
      },

      scheduledBroadcasts: {
        total: scheduledBroadcastsTotal,
        queued: scheduledBroadcastsQueued,
        completed: scheduledBroadcastsCompleted,
        failed: scheduledBroadcastsFailed,
        recipientCount: scheduledBroadcastRecipients,
      },

      pendingOutreach: {
        total: pendingOutreachTotal,
        active: pendingOutreachActive,
      },

      trackedLinks,

      daily: {
        startDate: trendStart,
        messages: dailyMessages,
        clicks: dailyClicks,
        failedMessages: dailyFailedMessages,
        automationRuns: dailyAutomationRuns,
      },

      rankings: {
        topTrackedLinks,
        topAutomationFailures,
      },
    });
  } catch (err) {
    /**
     * Erro geral da rota.
     * Qualquer erro não tratado numa query ou cálculo vem parar aqui.
     */
    console.error("[analytics/overview] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to load analytics overview",
      },
      { status: 500 }
    );
  }
}

