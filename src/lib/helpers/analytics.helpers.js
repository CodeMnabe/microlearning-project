/**
 * Lista de períodos aceites pela dashboard de Analytics.
 *
 * all  → sem filtro nas métricas gerais
 * 7d   → últimos 7 dias
 * 30d  → últimos 30 dias
 * 90d  → últimos 90 dias
 */
export const VALID_PERIODS = new Set(["all", "7d", "30d", "90d"]);

/**
 * Verifica se um valor está realmente preenchido.
 *
 * Evita contar valores vazios como:
 * - null
 * - undefined
 * - string vazia
 */
export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * Soma valores numéricos dentro de uma lista.
 *
 * Exemplo:
 * usado para somar recipient_count das mensagens agendadas.
 */
export function sumNumbers(items, key) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[key] ?? 0);

    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

/**
 * Converte o período escolhido numa data inicial.
 *
 * Exemplo:
 * - "7d" devolve a data de há 7 dias
 * - "30d" devolve a data de há 30 dias
 * - "all" devolve null, porque não queremos filtrar por data
 */
export function getPeriodStart(period) {
  /**
   * Se o período não for permitido,
   * devolvemos valid: false para a service poder lançar erro.
   */
  if (!VALID_PERIODS.has(period)) {
    return {
      valid: false,
      startDate: null,
    };
  }

  /**
   * No período "all", não existe data inicial.
   * Isto permite buscar dados de todo o histórico.
   */
  if (period === "all") {
    return {
      valid: true,
      startDate: null,
    };
  }

  /**
   * Remove o "d" do período.
   *
   * Exemplo:
   * "30d" → 30
   */
  const days = Number(period.replace("d", ""));

  /**
   * Cria uma data com base no dia atual
   * e subtrai o número de dias escolhido.
   */
  const date = new Date();
  date.setDate(date.getDate() - days);

  return {
    valid: true,
    startDate: date.toISOString(),
  };
}

/**
 * Aplica filtro de data a uma query Supabase.
 *
 * Se periodStart for null, não aplica filtro.
 *
 * Por defeito filtra pela coluna created_at,
 * mas podes passar outra coluna, como scheduled_for ou failed_at.
 */
export function applyPeriod(query, periodStart, dateColumn = "created_at") {
  if (!periodStart) return query;

  return query.gte(dateColumn, periodStart);
}

/**
 * Converte uma data para o formato YYYY-MM-DD.
 *
 * Usado para agrupar dados por dia nos gráficos.
 */
export function getDayKey(value) {
  if (!value) return null;

  const date = new Date(value);

  /**
   * Se a data for inválida, ignoramos esse valor.
   */
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

/**
 * Cria uma lista com todos os dias entre duas datas.
 *
 * Isto garante que os gráficos mostram também dias sem dados,
 * com valor 0.
 */
export function getDayRange(startDate, endDate = new Date()) {
  const days = [];

  /**
   * Começa no início do dia da data inicial.
   */
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);

  /**
   * Termina no início do dia da data final.
   */
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  /**
   * Adiciona todos os dias ao array até chegar à data final.
   */
  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

/**
 * Constrói uma série diária para os gráficos.
 *
 * Recebe linhas da base de dados e transforma em dados por dia.
 *
 * Exemplo de saída:
 * [
 *   { date: "2026-06-01", messages: 5 },
 *   { date: "2026-06-02", messages: 0 },
 *   { date: "2026-06-03", messages: 8 }
 * ]
 */
export function buildDailySeries(startDate, rows, dateColumn, valueKey) {
  /**
   * Cria todos os dias do período com valor inicial 0.
   */
  const countsByDay = Object.fromEntries(
    getDayRange(startDate).map((day) => [day, 0])
  );

  /**
   * Conta quantas linhas existem em cada dia.
   */
  rows.forEach((row) => {
    const day = getDayKey(row?.[dateColumn]);

    if (day && day in countsByDay) {
      countsByDay[day] += 1;
    }
  });

  /**
   * Converte o objeto final num array pronto para os gráficos.
   */
  return Object.entries(countsByDay).map(([date, value]) => ({
    date,
    [valueKey]: value,
  }));
}

/**
 * Converte qualquer valor para número de forma segura.
 *
 * Se o valor não for um número válido, devolve 0.
 */
export function safeNumberForApi(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

/**
 * Ordena uma lista por uma chave numérica e limita o número de resultados.
 *
 * Usado em rankings, por exemplo:
 * - links mais clicados
 * - automações com mais falhas
 */
export function sortAndLimit(items, key, limit = 5) {
  return [...items]
    .sort((a, b) => safeNumberForApi(b[key]) - safeNumberForApi(a[key]))
    .slice(0, limit);
}

/**
 * Executa uma métrica opcional com fallback.
 *
 * Se a métrica falhar, a dashboard continua a funcionar
 * e recebe o valor fallback.
 */
export async function withMetricFallback(label, promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    console.warn(`[analytics] ${label} failed:`, err);

    return fallback;
  }
}

/**
 * Calcula as datas usadas pela dashboard.
 *
 * periodStart:
 * usado nas métricas gerais.
 *
 * trendStart:
 * usado nos gráficos de evolução diária.
 * Se o período for "all", os gráficos usam 90 dias para não ficarem pesados.
 *
 * rankingStart:
 * usado nos rankings.
 * Se o período for "all", os rankings usam todo o histórico.
 */
export function getAnalyticsPeriodRange(period) {
  const { valid, startDate } = getPeriodStart(period);
  const { startDate: defaultTrendStart } = getPeriodStart("90d");

  const periodStart = startDate;
  const trendStart = periodStart || defaultTrendStart;
  const rankingStart = periodStart;

  return {
    valid,
    periodStart,
    trendStart,
    rankingStart,
  };
}