import { getSupabaseAdminClient } from "@/lib/db/admin";

// Quantas linhas pedimos de cada vez.
// Se este número for maior que o "Max rows" do projeto, o Supabase
// devolve menos — e não faz mal, porque avançamos pelo que recebemos
// e não pelo que pedimos.
const PAGE_SIZE = 1000;

// Trava de segurança: um erro de filtro não pode pôr isto a correr para sempre.
const MAX_PAGES = 200;

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
export async function fetchRows(table, columns, applyFilters, options = {}) {
  const supabaseAdmin = getSupabaseAdminClient();

  // Sem ORDER BY, o Postgres não garante a mesma ordem entre queries.
  // A paginar sem ordem estável, receberíamos linhas repetidas numas
  // páginas e nunca receberíamos outras.
  const orderColumn = options.orderColumn ?? "id";

  const rows = [];
  let from = 0;
  let total = null;
  let countRequested = false;
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    // Só pedimos a contagem na primeira página: é ela que nos diz quando
    // parar. Repeti-la em cada página seria obrigar o Postgres a contar
    // a tabela toda de cada vez.
    const selectOptions = countRequested ? {} : { count: "exact" };

    let query = supabaseAdmin.from(table).select(columns, selectOptions);

    // Os filtros de quem chamou entram primeiro, para que a ordem
    // e o intervalo que aplicamos a seguir não sejam substituídos.
    if (typeof applyFilters === "function") {
      query = applyFilters(query);
    }

    query = query
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    const received = data ?? [];

    rows.push(...received);

    countRequested = true;

    // Guardamos a contagem só se ela vier mesmo. Cair para
    // received.length seria dizer "o total é o tamanho da primeira
    // página", que é exatamente o truncamento que viemos corrigir.
    if (total === null && typeof count === "number") {
      total = count;
    }

    // Chegámos ao fim quando já temos tudo o que a contagem anunciou.
    // Se a contagem não veio, voltamos a depender da página vazia:
    // uma otimização que remove a rede de segurança antiga não é uma
    // otimização, é uma troca.
    if ((total !== null && rows.length >= total) || received.length === 0) {
      complete = true;
      break;
    }

    // Avançamos pelo que recebemos, não por PAGE_SIZE.
    from += received.length;
  }

  // Se saímos do ciclo sem chegar ao fim, é melhor rebentar do que
  // devolver dados incompletos em silêncio — que é o bug que viemos corrigir.
  if (!complete) {
    throw new Error(
      `${table}: mais de ${MAX_PAGES * PAGE_SIZE} linhas; revê o filtro ou pagina no chamador.`,
    );
  }

  return rows;
}