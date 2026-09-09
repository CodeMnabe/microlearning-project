import { applyPeriod } from "./analytics.helpers";
import { fetchRows } from "./analyticsBase.repo";

/**
 * Repositório das linhas de detalhe usadas na exportação.
 *
 * Ao contrário dos outros repos de analytics, que contam, este devolve
 * linhas: é o que alimenta as folhas onde cada registo é uma linha.
 *
 * Usa o `fetchRows`, e isso não é detalhe. É a função que paginámos
 * para deixar de truncar em silêncio no limite do PostgREST — sem ela,
 * um export de uma organização grande vinha cortado sem dizer nada.
 */

/**
 * Vai buscar as execuções de automação com o nome de quem as originou.
 *
 * Não reutilizamos o `getOrganizationMaterializedAutomationRuns` de
 * propósito. Essa função filtra por `scheduled_broadcast_id not null`
 * e limita a 100 linhas — devolve só as execuções que chegaram a virar
 * mensagem agendada. Numa folha de exportação isso esconderia
 * precisamente as que falharam antes de materializar, que são as que
 * alguém vai lá procurar.
 */
export async function getAutomationRunRows(orgId, periodStart) {
  return fetchRows(
    "automation_run",
    `
      id,
      rule_id,
      user_id,
      status,
      created_at,
      scheduled_for,
      processed_at,
      last_error,
      scheduled_broadcast_id,
      user_row:user!automation_run_user_id_fkey (
        id,
        name,
        email
      )
    `,
    (query) => applyPeriod(query.eq("organization_id", orgId), periodStart),
  );
}

/**
 * Vai buscar os nomes das regras de automação da organização.
 *
 * Serve para trocar o `rule_id` por algo legível na folha. Fica numa
 * chamada separada em vez de uma junção porque as regras são poucas e
 * repetem-se muito: trazê-las uma vez e cruzar em memória é mais barato
 * do que repetir o nome em cada execução.
 */
export async function getAutomationRuleNames(orgId) {
  const rules = await fetchRows("automation_rule", "id, name", (query) =>
    query.eq("organization_id", orgId),
  );

  return new Map(rules.map((rule) => [rule.id, rule.name]));
}

/**
 * Vai buscar as mensagens agendadas da organização.
 *
 * O filtro de período aplica-se a `scheduled_for` e não a `created_at`,
 * para acompanhar o critério que o resto da camada já usa nesta tabela.
 */
export async function getScheduledBroadcastRows(orgId, periodStart) {
  return fetchRows(
    "scheduled_broadcast",
    `
      id,
      status,
      channel,
      scheduled_for,
      recipient_count,
      started_at,
      completed_at,
      created_at,
      updated_at
    `,
    (query) =>
      applyPeriod(
        query.eq("organization_id", orgId),
        periodStart,
        "scheduled_for",
      ),
  );
}

/**
 * Se o conteúdo das mensagens entra na exportação.
 *
 * Fica em `false` de propósito. Com ele ligado, o ficheiro passa a
 * conter as conversas todas e muda de categoria em RGPD: deixa de ser
 * um relatório de métricas e passa a ser um export de dados pessoais,
 * com as obrigações que isso traz.
 *
 * É uma constante e não um parâmetro do pedido de propósito. Se fosse
 * `?content=1`, qualquer pessoa com sessão podia levar as conversas —
 * a decisão passaria a ser de quem chama, e não de quem é responsável
 * pelos dados.
 */
const INCLUDE_MESSAGE_CONTENT = false;

/**
 * Vai buscar as mensagens da organização, uma linha por mensagem.
 *
 * As colunas seguem o `MESSAGE_SELECT` de `repos/messages.repo.js`, para
 * a exportação mostrar os mesmos campos que o resto da aplicação usa.
 */
export async function getMessageRows(orgId, periodStart) {
  const columns = [
    "id",
    "created_at",
    "channel",
    "role",
    "delivery_status",
    "delivered_at",
    "read_at",
    "failed_at",
    "user_id",
    "assistant_id",
    "thread_id",
    "scheduled_broadcast_id",
    "automation_run_id",
    "message_chain_id",
    "message_chain_step_index",
    ...(INCLUDE_MESSAGE_CONTENT ? ["content"] : []),
  ].join(", ");

  return fetchRows("message", columns, (query) =>
    applyPeriod(query.eq("organization_id", orgId), periodStart),
  );
}

/**
 * Vai buscar os utilizadores da organização com as etiquetas deles.
 *
 * Não leva filtro de período: um export de utilizadores é o retrato de
 * quem existe agora, não de quem foi criado numa janela. Filtrar por
 * data de criação daria uma lista incompleta e enganadora, porque as
 * mensagens do período podem ser de pessoas registadas antes dele.
 */
export async function getUserRows(orgId) {
  return fetchRows(
    "user",
    `
      id,
      name,
      email,
      phone_number,
      phone_country_code,
      phone_national,
      whatsapp_bsuid,
      whatsapp_username,
      bird_contact_id,
      teams_aad_object_id,
      assistant_id,
      created_at,
      user_tag:user_tag (
        tag:tags ( id, name )
      )
    `,
    (query) => query.eq("organization_id", orgId),
  );
}

/**
 * Vai buscar os templates de WhatsApp visíveis para a organização.
 *
 * O filtro `org_id.eq.X,org_id.is.null` é o mesmo que o repo de
 * contagens usa: além dos próprios, a organização vê os templates
 * globais, que não pertencem a ninguém.
 *
 * Sem período: um template não é um acontecimento datado, é uma coisa
 * que existe ou não existe agora.
 */
export async function getTemplateRows(orgId) {
  return fetchRows(
    "whatsapp_templates",
    "id, name, language, status, org_id, provider_template_id, created_at",
    (query) => query.or(`org_id.eq.${orgId},org_id.is.null`),
  );
}
