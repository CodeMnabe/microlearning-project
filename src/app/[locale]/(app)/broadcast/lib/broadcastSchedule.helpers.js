/**
 * Agendamento da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */
/**
 * Cria a data inicial sugerida para agendamento.
 *
 * A data é arredondada para o próximo bloco de 5 minutos
 * e empurrada alguns minutos para o futuro para evitar valores já expirados.
 */
export function buildInitialScheduledDate() {
  const date = new Date();

  date.setMinutes(date.getMinutes() + 5);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);

  return date;
}

/**
 * Formata a hora de uma data para o input de hora.
 *
 * Devolve sempre dois dígitos para manter o input previsível.
 */
export function formatHour(date) {
  return String(date.getHours()).padStart(2, "0");
}

/**
 * Formata os minutos de uma data para o input de minutos.
 *
 * Devolve sempre dois dígitos para evitar inconsistências na UI.
 */
export function formatMinute(date) {
  return String(date.getMinutes()).padStart(2, "0");
}

/**
 * Limpa o valor introduzido nos campos de hora/minuto.
 *
 * Remove caracteres inválidos e mantém apenas o necessário
 * para validar o horário.
 */
export function cleanTimeDraft(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 2);
}

/**
 * Valida hora e minuto antes de aplicar ao agendamento.
 *
 * Esta função concentra as regras de horário permitido.
 * Deve devolver um resultado previsível para o hook mostrar erro
 * ou aceitar o valor.
 */
export function validateScheduleTimeParts(hourValue, minuteValue) {
  const rawHour = String(hourValue || "").trim();
  const rawMinute = String(minuteValue || "").trim();

  if (!rawHour || !rawMinute) {
    return {
      ok: false,
      error: "Fill in both hour and minute.",
    };
  }

  if (!/^\d{1,2}$/.test(rawHour) || !/^\d{1,2}$/.test(rawMinute)) {
    return {
      ok: false,
      error: "Use only numbers.",
    };
  }

  const hours = Number(rawHour);
  const minutes = Number(rawMinute);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return {
      ok: false,
      error: "Enter a valid time.",
    };
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return {
      ok: false,
      error: "Enter a valid time.",
    };
  }

  const totalMinutes = hours * 60 + minutes;
  const minMinutes = 8 * 60;
  const maxMinutes = 20 * 60;

  if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
    return {
      ok: false,
      error: "Choose a time between 08:00 and 20:00.",
    };
  }

  return {
    ok: true,
    error: "",
    hours,
    minutes,
  };
}

/**
 * Aplica hora e minuto a uma data já escolhida.
 *
 * Mantém o dia selecionado pelo utilizador e atualiza apenas
 * a parte horária.
 */
export function applyTimeToDate(dateValue, hours, minutes) {
  const next = new Date(dateValue);

  next.setHours(hours, minutes, 0, 0);

  return next;
}

/**
 * Valida se um valor pode ser tratado como data.
 */
export function isValidDate(dateValue) {
  const date = new Date(dateValue);

  return !Number.isNaN(date.getTime());
}

/**
 * Verifica se uma data está no futuro.
 *
 * Usado para impedir agendamentos com datas passadas.
 */
export function isFutureDate(dateValue, now = Date.now()) {
  const date = new Date(dateValue);

  return isValidDate(date) && date.getTime() > now;
}

/**
 * Constrói uma data final a partir da data selecionada
 * e dos drafts de hora/minuto.
 *
 * Se os drafts forem inválidos, devolve null para impedir
 * o agendamento.
 */
export function getScheduledDateFromDraft(dateValue, hourValue, minuteValue) {
  if (!isValidDate(dateValue)) {
    return null;
  }

  const validation = validateScheduleTimeParts(hourValue, minuteValue);

  if (!validation.ok) {
    return null;
  }

  return applyTimeToDate(dateValue, validation.hours, validation.minutes);
}
