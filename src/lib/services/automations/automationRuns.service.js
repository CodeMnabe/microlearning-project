import {
  getOrganizationAutomationRuns,
  getOrganizationMaterializedAutomationRuns,
} from "@/lib/repos/automations/automationRuns.repo";

/**
 * Lista os runs de uma organização.
 *
 * O service mantém-se simples nesta fase porque
 * não estamos a alterar regras de negócio.
 */
export async function listAutomationRuns({
  organizationId,
  limit,
}) {
  return getOrganizationAutomationRuns({
    organizationId,
    limit,
  });
}

/**
 * Lista runs já associados a scheduled broadcasts.
 */
export async function listMaterializedAutomationRuns({
  organizationId,
  limit,
}) {
  return getOrganizationMaterializedAutomationRuns({
    organizationId,
    limit,
  });
}