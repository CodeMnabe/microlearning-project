/**
 * Helpers usados pelo serviço de Analytics.
 *
 * Reúne funções puras aplicadas na construção da resposta da dashboard:
 * - validar os períodos aceites;
 * - calcular os intervalos temporais usados nas métricas, gráficos e rankings;
 * - construir séries diárias contínuas;
 * - garantir fallbacks quando métricas opcionais falham.
 *
 * Os helpers aplicados diretamente às queries ficam em
 * `repos/analytics/analytics.helpers`.
 */

/**
 * Lista de períodos aceites pela dashboard Analytics.
 *
 * - all: sem filtro nas métricas gerais
 * - 7d: últimos 7 dias
 * - 30d: últimos 30 dias
 * - 90d: últimos 90 dias
 */
export const VALID_PERIODS = new Set(["all", "7d", "30d", "90d"]);

/**
 * Converte o período escolhido numa data inicial.
 *
 * "all" devolve null.
 * Períodos como "7d", "30d" e "90d" devolvem uma data ISO.
 */
export function getPeriodStart(period) {
  if (!VALID_PERIODS.has(period)) {
    return {
      valid: false,
      startDate: null,
    };
  }

  if (period === "all") {
    return {
      valid: true,
      startDate: null,
    };
  }

  const days = Number(period.replace("d", ""));
  const date = new Date();

  date.setDate(date.getDate() - days);

  return {
    valid: true,
    startDate: date.toISOString(),
  };
}

/**
 * Converte uma data numa chave diária no formato YYYY-MM-DD.
 *
 * Usado para agrupar dados nos gráficos diários.
 */
export function getDayKey(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

/**
 * Cria uma lista contínua de dias entre duas datas.
 *
 * Garante que os gráficos também mostram dias sem dados.
 */
export function getDayRange(startDate, endDate = new Date()) {
  const days = [];

  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

/**
 * Constrói uma série diária contínua para gráficos.
 *
 * Recebe linhas da base de dados e transforma-as numa lista por dia.
 * Dias sem dados entram com valor 0.
 */
export function buildDailySeries(startDate, rows, dateColumn, valueKey) {
  const countsByDay = Object.fromEntries(
    getDayRange(startDate).map((day) => [day, 0]),
  );

  rows.forEach((row) => {
    const day = getDayKey(row?.[dateColumn]);

    if (day && day in countsByDay) {
      countsByDay[day] += 1;
    }
  });

  return Object.entries(countsByDay).map(([date, value]) => ({
    date,
    [valueKey]: value,
  }));
}

/**
 * Executa uma métrica opcional com fallback.
 *
 * Se a métrica falhar, a dashboard continua funcional
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
 * Calcula os intervalos temporais usados pela dashboard Analytics.
 *
 * periodStart é usado nas métricas gerais.
 * trendStart é usado nos gráficos diários.
 * rankingStart é usado nos rankings.
 *
 * Quando o período é "all", os gráficos usam 90 dias
 * para evitar séries demasiado pesadas.
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
