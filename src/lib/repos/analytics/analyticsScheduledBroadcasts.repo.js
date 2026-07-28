import {
  applyPeriod,
  sumNumbers,
} from "./analytics.helpers";

import { fetchRows } from "./analyticsBase.repo";

/**
 * Vai buscar métricas das mensagens/envios agendados da organização.
 *
 * Devolve:
 * - total de envios agendados;
 * - envios em fila;
 * - envios concluídos;
 * - envios falhados;
 * - total de destinatários.
 */

export async function getScheduledBroadcastMetrics(orgId, periodStart) {
  /**
   * Vai buscar os envios agendados da organização.
   *
   * O filtro de período usa a coluna scheduled_for,
   * porque aqui queremos medir a data em que o envio estava agendado.
   */
  const rows = await fetchRows(
    "scheduled_broadcast",
    "id, status, channel, recipient_count",
    (q) =>
      applyPeriod(
        q.eq("organization_id", orgId),
        periodStart,
        "scheduled_for"
      )
  );

  /**
   * Total de envios agendados encontrados.
   */
  const total = rows.length;

  /**
   * Conta envios que ainda estão em fila ou pendentes.
   *
   * Convertimos o status para lowercase para evitar problemas
   * caso venha "Queued", "QUEUED" ou outro formato semelhante.
   */
  const queued = rows.filter((item) =>
    ["queued", "pending", "scheduled"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  /**
   * Conta envios concluídos com sucesso.
   *
   * Consideramos vários nomes possíveis de estado:
   * - completed
   * - sent
   * - done
   */
  const completed = rows.filter((item) =>
    ["completed", "sent", "done"].includes(
      String(item.status || "").toLowerCase()
    )
  ).length;

  /**
   * Conta envios que falharam.
   */
  const failed = rows.filter((item) =>
    ["failed", "error"].includes(String(item.status || "").toLowerCase())
  ).length;

  /**
   * Soma o número de destinatários de todos os envios.
   *
   * Usa sumNumbers para garantir que valores inválidos
   * não quebram a soma.
   */
  const recipientCount = sumNumbers(rows, "recipient_count");

  /**
   * Devolve as métricas no formato usado pela dashboard.
   */
  return {
    total,
    queued,
    completed,
    failed,
    recipientCount,
  };
}