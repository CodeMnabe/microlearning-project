export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com Service Role.
 *
 * Esta rota corre no servidor e precisa de consultar métricas globais da organização,
 * por isso usamos a service role para evitar limitações de RLS.
 *
 * Nunca expor SUPABASE_SERVICE_ROLE_KEY no frontend.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Conta registos de uma tabela sem ir buscar os dados completos.
 *
 * O uso de:
 * .select("*", { count: "exact", head: true })
 *
 * permite ao Supabase devolver apenas o número total de linhas.
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
 * Vai buscar linhas completas/parciais de uma tabela.
 *
 * Usamos esta função quando não basta contar.
 *
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
 * Verifica se um valor existe de forma útil.
 *
 * Consideramos inválidos:
 * - null
 * - undefined
 * - string vazia
 * - string só com espaços
 */
function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * Soma valores numéricos dentro de uma lista de objetos.
 *
 * Serve para somar o número total de destinatários das mensagens agendadas.
 */
function sumNumbers(items, key) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[key] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/**
 * Calcula métricas de links rastreados.
 *
 * A tabela tracked_link_event não tem org_id diretamente.
 * Por isso fazemos em dois passos:
 *
 * 1. Buscar os tracked_link da organização.
 * 2. Contar eventos de click associados a esses links.
 */
async function getTrackedLinkMetrics(orgId) {
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
    q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds)
  );

  return {
    totalLinks: trackedLinkIds.length,
    totalClicks,
  };
}

/**
 * GET /api/analytics/overview?orgId=...
 *
 * Esta rota devolve um resumo geral das métricas de uma organização.
 * A ideia é a página /analytics chamar apenas esta API,
 * Isto torna o frontend mais simples e centraliza a lógica das métricas no backend.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    /**
     * Validação obrigatória.
     *
     * Sem orgId não conseguimos saber de que organização devemos calcular métricas.
     */
    if (!orgId || Number.isNaN(orgId)) {
      return NextResponse.json(
        { error: "Missing or invalid orgId" },
        { status: 400 }
      );
    }

    /**
     * Executamos várias queries em paralelo.
     *
     * Promise.all melhora a performance porque não esperamos por uma query
     * para só depois começar a próxima.
     *
     * Cada posição deste array corresponde à variável na destructuring abaixo.
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
      /**
       * Utilizadores da organização.
       *
       * Aqui precisamos das linhas completas/parciais porque algumas métricas
       * dependem de verificar se certos campos estão preenchidos.
       */
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

      /**
       * Assistentes.
       *
       * Total de assistentes da organização.
       */
      countRows("assistant", (q) => q.eq("organization_id", orgId)),

      /**
       * Assistentes sem open_ai_id.
       *
       * Esta métrica é importante porque um assistente sem OpenAI ID
       * pode estar mal configurado e não conseguir responder.
       */
      countRows("assistant", (q) =>
        q.eq("organization_id", orgId).or("open_ai_id.is.null,open_ai_id.eq.")
      ),

      /**
       * Templates WhatsApp.
       *
       * Incluímos:
       * - templates específicos da organização;
       * - templates globais, quando org_id é null.
       */
      countRows("whatsapp_templates", (q) =>
        q.or(`org_id.eq.${orgId},org_id.is.null`)
      ),

      /**
       * Templates ativos/aprovados.
       */
      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["ACTIVE", "active", "APPROVED", "approved"])
      ),

      /**
       * Templates pendentes, novos ou em draft.
       */
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

      /**
       * Templates rejeitados ou inativos.
       */
      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["REJECTED", "rejected", "INACTIVE", "inactive"])
      ),

      /**
       * Mensagens.
       *
       * A tabela message é uma das fontes principais de métricas.
       */
      countRows("message", (q) => q.eq("organization_id", orgId)),

      /**
       * Mensagens por canal.
       */
      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("channel", "whatsapp")
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("channel", "teams")
      ),

      /**
       * Mensagens por role.
       *
       * role=user representa mensagens enviadas por utilizadores.
       * role=assistant representa respostas do assistente.
       */
      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("role", "user")
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("role", "assistant")
      ),

      /**
       * Estados das mensagens.
       *
       * delivered_at preenchido = mensagem entregue.
       * read_at preenchido = mensagem lida.
       * failed_at preenchido = mensagem falhada.
       */
      countRows("message", (q) =>
        q.eq("organization_id", orgId).not("delivered_at", "is", null)
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).not("read_at", "is", null)
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).not("failed_at", "is", null)
      ),

      /**
       * Regras de automação.
       */
      countRows("automation_rule", (q) => q.eq("organization_id", orgId)),

      countRows("automation_rule", (q) =>
        q.eq("organization_id", orgId).eq("is_active", true)
      ),

      /**
       * Execuções de automações.
       */
      countRows("automation_run", (q) => q.eq("organization_id", orgId)),

      /**
       * Execuções processadas.
       *
       * processed_at preenchido indica que a execução já foi tratada.
       */
      countRows("automation_run", (q) =>
        q.eq("organization_id", orgId).not("processed_at", "is", null)
      ),

      /**
       * Execuções com erro.
       *
       * last_error preenchido indica falha na execução.
       */
      countRows("automation_run", (q) =>
        q.eq("organization_id", orgId).not("last_error", "is", null)
      ),

      /**
       * Mensagens agendadas.
       *
       * Aqui buscamos linhas em vez de contar diretamente,
       * porque precisamos de calcular totais por status
       * e somar recipient_count.
       */
      fetchRows(
        "scheduled_broadcast",
        "id, status, channel, recipient_count",
        (q) => q.eq("organization_id", orgId)
      ),

      /**
       * Pending outreach.
       *
       * Representa mensagens/contactos pendentes.
       */
      countRows("pending_outreach", (q) => q.eq("org_id", orgId)),

      countRows("pending_outreach", (q) =>
        q.eq("org_id", orgId).in("status", ["pending", "queued", "active"])
      ),

      /**
       * Métricas de tracked links.
       *
       * Calculadas numa função própria porque precisam de passar
       * de tracked_link para tracked_link_event.
       */
      getTrackedLinkMetrics(orgId),
    ]);

    /**
     * Métricas derivadas de utilizadores.
     *
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
     * Métricas derivadas de mensagens agendadas.
     *
     * Agrupamos manualmente os status para aceitar nomes diferentes
     * que possam existir na base de dados.
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
     * Resposta final da API.
     *
     * O frontend recebe este objeto e mostra os cards da página Analytics.
     */
    return NextResponse.json({
      ok: true,

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
    });
  } catch (err) {
    /**
     * Erro geral da rota.
     *
     * Qualquer erro numa query ou cálculo vem parar aqui.
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