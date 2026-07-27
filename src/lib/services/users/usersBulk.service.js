import { deleteUser, updateUser } from "@/lib/repos/user.repo";
import {
  addTagsToUsers,
  removeTagsFromUsers,
  replaceTagsForUsers,
} from "@/lib/repos/userTags.repo";

/**
 * Regras de negócio das ações em massa sobre utilizadores.
 *
 * As operações recebem apenas recursos cuja organização já foi validada
 * pela camada HTTP. A alteração de assistente reutiliza o update individual
 * para preservar as regras associadas às automações.
 */

/**
 * Operações suportadas na alteração de tags em massa.
 */
export const BULK_TAG_OPERATIONS = {
  ADD: "add",
  REMOVE: "remove",
  SET: "set",
};

/**
 * Altera o assistente de todos os utilizadores indicados.
 */
export function bulkSetAssistant({ userIds, assistantId }) {
  return Promise.all(
    userIds.map((userId) => updateUser(Number(userId), { assistantId })),
  );
}

/**
 * Adiciona, remove ou substitui as tags dos utilizadores indicados.
 *
 * A operação tem de ser uma das definidas em `BULK_TAG_OPERATIONS`.
 */
export function bulkModifyTags(sb, { userIds, tagIds, op }) {
  if (op === BULK_TAG_OPERATIONS.ADD) {
    return addTagsToUsers(sb, { userIds, tagIds });
  }

  if (op === BULK_TAG_OPERATIONS.REMOVE) {
    return removeTagsFromUsers(sb, { userIds, tagIds });
  }

  if (op === BULK_TAG_OPERATIONS.SET) {
    return replaceTagsForUsers(sb, { userIds, tagIds });
  }

  throw new Error(`Unsupported bulk tag operation: ${op}`);
}

/**
 * Remove vários utilizadores, um a um.
 *
 * As remoções são independentes: uma falha não impede as restantes.
 * O resumo devolvido indica quantas tiveram sucesso e quais falharam.
 */
export async function bulkDeleteUsers({ userIds = [] }) {
  const results = await Promise.allSettled(
    userIds.map((id) => deleteUser(Number(id))),
  );

  const failed = results
    .map((result, index) => ({ result, id: userIds[index] }))
    .filter(({ result }) => result.status === "rejected")
    .map(({ result, id }) => ({
      id,
      error: result.reason?.message || "Failed to delete user",
    }));

  return {
    ok: failed.length === 0,
    deleted: userIds.length - failed.length,
    failedCount: failed.length,
    failed,
  };
}
