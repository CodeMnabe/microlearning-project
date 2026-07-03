import { getSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Conta linhas de uma tabela da Supabase.
 *
 * Esta função é usada quando só queremos saber "quantos registos existem",
 * sem precisar de ir buscar os dados completos.
 *
 * Exemplo:
 * contar quantas mensagens existem numa organização.
 */

export async function countRows(table, applyFilters) {
  /**
   * Vai buscar o cliente admin da Supabase.
   *
   * Este cliente usa a service role key,
   * por isso só deve ser usado no servidor.
   */
  const supabaseAdmin = getSupabaseAdminClient();

  /**
   * Cria a query base para contar linhas.
   *
   * select("*", { count: "exact", head: true })
   *
   * count: "exact"
   * pede à Supabase a contagem exata.
   *
   * head: true
   * significa que não queremos receber os dados,
   * só queremos a contagem.
   */
  let query = supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  /**
   * Se for passada uma função de filtros,
   * aplicamos essa função à query.
   *
   * Exemplo:
   * (q) => q.eq("organization_id", orgId)
   */
  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  /**
   * Executa a query.
   *
   * count recebe o número de linhas encontradas.
   * error recebe algum erro, se a query falhar.
   */
  const { count, error } = await query;

  /**
   * Se houver erro na query,
   * lançamos uma mensagem com o nome da tabela.
   *
   * Isto ajuda a perceber rapidamente que tabela falhou.
   */
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  /**
   * Se count vier null ou undefined,
   * devolvemos 0 por segurança.
   */
  return count ?? 0;
}

/**
 * Vai buscar linhas de uma tabela da Supabase.
 *
 * Esta função é usada quando precisamos dos dados completos
 * e não apenas de uma contagem.
 *
 * Exemplo:
 * buscar links rastreados, utilizadores ou execuções de automação.
 */
export async function fetchRows(table, columns, applyFilters) {
  /**
   * Vai buscar o cliente admin da Supabase.
   */
  const supabaseAdmin = getSupabaseAdminClient();

  /**
   * Cria a query base.
   *
   * table:
   * nome da tabela.
   *
   * columns:
   * colunas que queremos buscar.
   *
   * Exemplo:
   * "id, name, created_at"
   */
  let query = supabaseAdmin.from(table).select(columns);

  /**
   * Aplica filtros opcionais à query.
   *
   * Exemplo:
   * (q) => q.eq("organization_id", orgId)
   */
  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  /**
   * Executa a query.
   *
   * data recebe as linhas encontradas.
   * error recebe algum erro, se a query falhar.
   */
  const { data, error } = await query;

  /**
   * Se houver erro, lançamos uma mensagem
   * indicando a tabela onde aconteceu o problema.
   */
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  /**
   * Se data vier null ou undefined,
   * devolvemos array vazio para evitar erros no resto do código.
   */
  return data ?? [];
}