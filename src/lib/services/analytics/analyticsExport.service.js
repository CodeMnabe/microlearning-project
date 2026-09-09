import { getAnalyticsPeriodRange } from "./analytics.helpers";

import {
  getAutomationRunRows,
  getAutomationRuleNames,
  getScheduledBroadcastRows,
  getMessageRows,
  getUserRows,
  getTemplateRows,
} from "@/lib/repos/analytics/analyticsExport.repo";

import { getTrackedLinkReportsByOrg } from "@/lib/repos/broadcast/trackedLinks.repo";

/**
 * Dataset de detalhe da exportação.
 *
 * A `getAnalyticsOverview` devolve contagens; esta devolve linhas. São
 * as duas faces do mesmo período: o Resumo mostra "825 mensagens", este
 * dataset mostra as 825.
 *
 * O período atravessa tudo de propósito. Se as folhas de detalhe
 * ignorassem o filtro, um export de "últimos 7 dias" traria resumo de
 * 7 dias e detalhe de sempre — os totais não bateriam certo com as
 * linhas por baixo deles, e ninguém saberia qual acreditar.
 */
export async function getAnalyticsExportDataset({ orgId, period }) {
  const { valid, periodStart, rankingStart } = getAnalyticsPeriodRange(period);

  if (!valid) {
    const error = new Error("Invalid period");
    error.status = 400;
    throw error;
  }

  /**
   * Os nomes das regras vão em paralelo com o resto: são poucos e não
   * dependem de nada, mas seriam uma espera desnecessária em série.
   */
  const [
    runRows,
    ruleNames,
    scheduledRows,
    linkReports,
    messageRows,
    userRows,
    templateRows,
  ] =
    await Promise.all([
      getAutomationRunRows(orgId, periodStart),
      getAutomationRuleNames(orgId),
      getScheduledBroadcastRows(orgId, periodStart),
      getTrackedLinkReportsByOrg(orgId, rankingStart),
      getMessageRows(orgId, periodStart),
      getUserRows(orgId),
      getTemplateRows(orgId),
    ]);

  /**
   * Achatamos as execuções aqui e não no repo.
   *
   * O repo devolve a forma que o Supabase deu, com o utilizador
   * aninhado. Quem escreve a folha quer uma linha plana, com uma coluna
   * por célula. Esta tradução é trabalho de composição, e é por isso
   * que vive na service.
   */
  const automationRuns = runRows.map((run) => ({
    id: run.id,
    rule: ruleNames.get(run.rule_id) ?? null,
    ruleId: run.rule_id,
    status: run.status,
    userName: run.user_row?.name ?? null,
    userEmail: run.user_row?.email ?? null,
    createdAt: run.created_at,
    scheduledFor: run.scheduled_for,
    processedAt: run.processed_at,
    lastError: run.last_error,
    scheduledBroadcastId: run.scheduled_broadcast_id,
  }));

  /**
   * As mensagens saem quase como vêm: já são planas.
   *
   * Só renomeamos para camelCase, para a folha não misturar
   * `delivered_at` com `recipientCount` na mesma linha de cabeçalhos.
   */
  const messages = messageRows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    channel: row.channel,
    role: row.role,
    deliveryStatus: row.delivery_status,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at,
    userId: row.user_id,
    assistantId: row.assistant_id,
    threadId: row.thread_id,
    scheduledBroadcastId: row.scheduled_broadcast_id,
    automationRunId: row.automation_run_id,
    messageChainId: row.message_chain_id,
    messageChainStepIndex: row.message_chain_step_index,
    ...(row.content === undefined ? {} : { content: row.content }),
  }));

  /**
   * Os utilizadores trazem as etiquetas por duas junções aninhadas.
   *
   * Juntamos os nomes numa string separada por vírgulas: uma célula de
   * folha de cálculo não guarda listas, e uma coluna por etiqueta
   * mudaria de forma consoante a organização.
   */
  const users = userRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone_number,
    phoneCountryCode: row.phone_country_code,
    phoneNational: row.phone_national,
    whatsappId: row.whatsapp_bsuid,
    whatsappUsername: row.whatsapp_username,
    birdContactId: row.bird_contact_id,
    teamsId: row.teams_aad_object_id,
    assistantId: row.assistant_id,
    createdAt: row.created_at,
    tags: (row.user_tag ?? [])
      .map((link) => link.tag?.name)
      .filter(Boolean)
      .join(", "),
  }));

  const templates = templateRows.map((row) => ({
    id: row.id,
    name: row.name,
    language: row.language,
    status: row.status,
    // `org_id` nulo significa template global, partilhado por todas as
    // organizações. Traduzimos isso em vez de mostrar uma célula vazia.
    scope: row.org_id === null ? "global" : "org",
    providerTemplateId: row.provider_template_id,
    createdAt: row.created_at,
  }));

  const scheduledBroadcasts = scheduledRows.map((row) => ({
    id: row.id,
    status: row.status,
    channel: row.channel,
    scheduledFor: row.scheduled_for,
    recipientCount: row.recipient_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));

  return {
    ok: true,

    period: {
      value: period,
      startDate: periodStart,
    },

    /**
     * Contagens de cada conjunto.
     *
     * Vão no payload para o cliente poder confirmar que recebeu tudo,
     * sem ter de contar arrays. Também é o que permite avisar quando um
     * export sai vazio por causa do período, em vez de parecer avariado.
     */
    counts: {
      messages: messages.length,
      users: users.length,
      templates: templates.length,
      automationRuns: automationRuns.length,
      scheduledBroadcasts: scheduledBroadcasts.length,
      trackedLinkGroups: linkReports.length,
    },

    messages,
    users,
    templates,
    automationRuns,
    scheduledBroadcasts,
    trackedLinks: linkReports,
  };
}
