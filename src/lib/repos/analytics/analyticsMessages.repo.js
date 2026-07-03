import { applyPeriod } from "@/lib/helpers/analytics.helpers";
import { countRows } from "./analyticsBase.repo";

/**
 * Vai buscar métricas das mensagens da organização.
 *
 * Devolve:
 * - total de mensagens;
 * - mensagens por canal;
 * - mensagens por role;
 * - mensagens entregues;
 * - mensagens lidas;
 * - mensagens falhadas.
 */

export async function getMessageMetrics(orgId, periodStart) {
  /**
   * Executa todas as contagens em paralelo.
   *
   * Isto evita fazer uma query de cada vez
   * e melhora a performance da API.
   */
  const [
    total,
    whatsapp,
    teams,
    userMessages,
    assistantMessages,
    delivered,
    read,
    failed,
  ] = await Promise.all([
    /**
     * Conta todas as mensagens da organização dentro do período selecionado.
     */
    countRows("message", (q) =>
      applyPeriod(q.eq("organization_id", orgId), periodStart)
    ),

    /**
     * Conta mensagens enviadas ou recebidas pelo canal WhatsApp.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).eq("channel", "whatsapp"),
        periodStart
      )
    ),

    /**
     * Conta mensagens enviadas ou recebidas pelo canal Teams.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).eq("channel", "teams"),
        periodStart
      )
    ),

    /**
     * Conta mensagens criadas por utilizadores.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).eq("role", "user"),
        periodStart
      )
    ),

    /**
     * Conta mensagens criadas pelo assistente.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).eq("role", "assistant"),
        periodStart
      )
    ),

    /**
     * Conta mensagens entregues.
     *
     * Uma mensagem é considerada entregue quando delivered_at está preenchido.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("delivered_at", "is", null),
        periodStart
      )
    ),

    /**
     * Conta mensagens lidas.
     *
     * Uma mensagem é considerada lida quando read_at está preenchido.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("read_at", "is", null),
        periodStart
      )
    ),

    /**
     * Conta mensagens falhadas.
     *
     * Uma mensagem é considerada falhada quando failed_at está preenchido.
     */
    countRows("message", (q) =>
      applyPeriod(
        q.eq("organization_id", orgId).not("failed_at", "is", null),
        periodStart
      )
    ),
  ]);

  /**
   * Devolve as métricas no formato usado pela dashboard.
   */
  return {
    total,
    whatsapp,
    teams,
    userMessages,
    assistantMessages,
    delivered,
    read,
    failed,
  };
}