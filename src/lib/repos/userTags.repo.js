/**
 * Acesso à tabela de ligação entre utilizadores e tags.
 *
 * Todas as funções recebem o cliente Supabase como primeiro argumento,
 * seguindo a mesma convenção de `tag.repo.js`. Assim é quem chama que
 * decide se a operação corre com a sessão do utilizador ou com a
 * service role.
 */

/**
 * Constrói o produto cartesiano de utilizadores e tags,
 * no formato esperado pela tabela `user_tag`.
 */
function buildUserTagRows(userIds, tagIds) {
  const rows = [];

  for (const userId of userIds) {
    for (const tagId of tagIds) {
      rows.push({ user_id: userId, tag_id: tagId });
    }
  }

  return rows;
}

const UPSERT_OPTIONS = {
  onConflict: "user_id,tag_id",
  ignoreDuplicates: true,
};

/**
 * Associa as tags indicadas aos utilizadores, sem remover as existentes.
 */
export async function addTagsToUsers(sb, { userIds = [], tagIds = [] }) {
  const rows = buildUserTagRows(userIds, tagIds);

  const { error } = await sb.from("user_tag").upsert(rows, UPSERT_OPTIONS);

  if (error) throw error;
}

/**
 * Remove apenas as tags indicadas dos utilizadores.
 */
export async function removeTagsFromUsers(sb, { userIds = [], tagIds = [] }) {
  const { error } = await sb
    .from("user_tag")
    .delete()
    .in("user_id", userIds)
    .in("tag_id", tagIds);

  if (error) throw error;
}

/**
 * Substitui as tags dos utilizadores pelas indicadas.
 *
 * Uma lista de tags vazia deixa os utilizadores sem tags.
 */
export async function replaceTagsForUsers(sb, { userIds = [], tagIds = [] }) {
  const { error: deleteError } = await sb
    .from("user_tag")
    .delete()
    .in("user_id", userIds);

  if (deleteError) throw deleteError;

  if (!tagIds.length) return;

  const rows = buildUserTagRows(userIds, tagIds);

  const { error: insertError } = await sb
    .from("user_tag")
    .upsert(rows, UPSERT_OPTIONS);

  if (insertError) throw insertError;
}
