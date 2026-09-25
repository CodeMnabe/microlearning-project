import { hasValue } from "@/lib/helpers/analytics.helpers";
import { fetchRows } from "./analyticsBase.repo";

/**
 * Vai buscar métricas dos utilizadores da organização.
 *
 * Devolve:
 * - total de utilizadores;
 * - utilizadores com assistente associado;
 * - utilizadores sem assistente;
 * - utilizadores com email;
 * - utilizadores com telefone;
 * - utilizadores com Teams;
 * - utilizadores com WhatsApp.
 */
export async function getUserMetrics(orgId) {
  /**
   * Vai buscar os utilizadores da organização.
   *
   * Só pedimos as colunas necessárias para calcular as métricas,
   * em vez de trazer todos os dados da tabela.
   */
  const users = await fetchRows(
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
  );

  /**
   * Total de utilizadores encontrados.
   */
  const total = users.length;

  /**
   * Conta utilizadores que têm um assistente associado.
   */
  const withAssistant = users.filter((user) =>
    hasValue(user.assistant_id)
  ).length;

  /**
   * Conta utilizadores com email preenchido.
   */
  const withEmail = users.filter((user) => hasValue(user.email)).length;

  /**
   * Conta utilizadores com telefone.
   *
   * Consideramos telefone válido se:
   * - phone_number estiver preenchido;
   * ou
   * - phone_country_code e phone_national estiverem preenchidos.
   */
  const withPhone = users.filter(
    (user) =>
      hasValue(user.phone_number) ||
      (hasValue(user.phone_country_code) && hasValue(user.phone_national))
  ).length;

  /**
   * Conta utilizadores com dados de Microsoft Teams.
   *
   * Consideramos Teams configurado se existir:
   * - teams_aad_object_id;
   * ou
   * - teams_from_id.
   */
  const withTeams = users.filter(
    (user) =>
      hasValue(user.teams_aad_object_id) || hasValue(user.teams_from_id)
  ).length;

  /**
   * Conta utilizadores com dados de WhatsApp.
   *
   * Consideramos WhatsApp configurado se existir:
   * - whatsapp_bsuid;
   * - bird_contact_id;
   * - phone_number;
   * - ou phone_country_code em conjunto com phone_national.
   *
   * O phone_number entra aqui porque, mesmo sem IDs externos,
   * o número pode permitir contacto por WhatsApp.
   */
  const withWhatsapp = users.filter(
    (user) =>
      hasValue(user.whatsapp_bsuid) ||
      hasValue(user.bird_contact_id) ||
      hasValue(user.phone_number) ||
      (hasValue(user.phone_country_code) && hasValue(user.phone_national))
  ).length;

  /**
   * Devolve as métricas no formato usado pela dashboard.
   *
   * withoutAssistant é calculado a partir do total,
   * para não fazer uma query extra.
   */
  return {
    total,
    withAssistant,
    withoutAssistant: Math.max(0, total - withAssistant),
    withEmail,
    withPhone,
    withTeams,
    withWhatsapp,
  };
}
