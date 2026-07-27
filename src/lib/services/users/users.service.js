import {
  deleteUser as deleteUserRow,
  getUsersInOrg,
  updateUser as updateUserRow,
} from "@/lib/repos/user.repo";
import { createUserWithAutomations } from "@/lib/services/automations/createUserWithAutomations";

import {
  buildCreatePhoneFields,
  buildUpdatePhoneFields,
} from "./users.helpers";

/**
 * Regras de negócio dos utilizadores.
 *
 * Esta camada:
 * - normaliza os dados recebidos antes de os enviar aos repositórios;
 * - coordena a criação com as automações associadas;
 * - lança erros com a mensagem original, deixando a tradução para
 *   respostas HTTP à responsabilidade das rotas.
 *
 * Não deve:
 * - conhecer `NextResponse`, códigos de estado ou cabeçalhos;
 * - ler parâmetros de pedidos;
 * - conter queries à base de dados.
 */

/**
 * Devolve uma página de utilizadores da organização,
 * no formato `{ items, total, page, pageSize }`.
 */
export function listUsers({ orgId, page, pageSize }) {
  return getUsersInOrg(orgId, { page, pageSize });
}

/**
 * Cria um utilizador e as automações desencadeadas pela criação.
 */
export function createUser({
  organizationId,
  name,
  email,
  assistantId,
  phoneNumber,
  phoneCountryCode,
  phoneNational,
  teamsAadObjectId,
  teamsFromId,
}) {
  const phone = buildCreatePhoneFields({
    phoneNumber,
    phoneCountryCode,
    phoneNational,
  });

  return createUserWithAutomations({
    organizationId,
    name,
    email,
    assistantId: assistantId ?? null,
    phoneNumber: phone.phoneNumber,
    phoneCountryCode: phone.phoneCountryCode,
    phoneNational: phone.phoneNational,
    teamsAadObjectId: teamsAadObjectId ?? null,
    teamsFromId: teamsFromId ?? null,
  });
}

/**
 * Atualiza um utilizador.
 *
 * Os campos ausentes não são alterados.
 */
export function updateUser({
  id,
  name,
  email,
  assistantId,
  tagIds,
  phoneNumber,
  phoneCountryCode,
  phoneNational,
  teamsAadObjectId,
  teamsFromId,
}) {
  const phone = buildUpdatePhoneFields({
    phoneNumber,
    phoneCountryCode,
    phoneNational,
  });

  return updateUserRow(id, {
    name,
    email,
    assistantId,
    tagIds,
    phoneNumber: phone.phoneNumber,
    phoneCountryCode: phone.phoneCountryCode,
    phoneNational: phone.phoneNational,
    teamsAadObjectId,
    teamsFromId,
  });
}

/**
 * Remove um utilizador.
 */
export function deleteUser(userId) {
  return deleteUserRow(userId);
}
