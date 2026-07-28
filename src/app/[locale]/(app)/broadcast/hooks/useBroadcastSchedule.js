"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyTimeToDate,
  buildInitialScheduledDate,
  cleanTimeDraft,
  formatHour,
  formatMinute,
  getScheduledDateFromDraft,
  isFutureDate,
  validateScheduleTimeParts,
} from "../lib";
/**
 * Gere o estado de agendamento do Broadcast.
 *
 * Controla a data, hora e minuto selecionados pelo utilizador.
 * Também valida se a data final é futura e se a hora está dentro
 * das regras permitidas pela feature.
 */

export function useBroadcastSchedule({ deliveryMode }) {
  const initialScheduledDate = useMemo(() => buildInitialScheduledDate(), []);

  const [scheduledFor, setScheduledFor] = useState(initialScheduledDate);
  const [hourDraft, setHourDraft] = useState(() =>
    formatHour(initialScheduledDate),
  );
  const [minuteDraft, setMinuteDraft] = useState(() =>
    formatMinute(initialScheduledDate),
  );
  const [timeError, setTimeError] = useState("");

  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const commitTimeParts = useCallback(
    (hourValue, minuteValue) => {
      const validation = validateScheduleTimeParts(hourValue, minuteValue);

      if (!validation.ok) {
        setTimeError(validation.error);
        return false;
      }

      const { hours, minutes } = validation;

      const next = applyTimeToDate(scheduledFor, hours, minutes);

      setScheduledFor(next);
      setHourDraft(String(hours).padStart(2, "0"));
      setMinuteDraft(String(minutes).padStart(2, "0"));
      setTimeError("");

      return true;
    },
    [scheduledFor],
  );

  function handleHourChange(value) {
    setHourDraft(cleanTimeDraft(value));
    setTimeError("");
  }

  function handleMinuteChange(value) {
    setMinuteDraft(cleanTimeDraft(value));
    setTimeError("");
  }

  useEffect(() => {
    setHourDraft(formatHour(scheduledFor));
    setMinuteDraft(formatMinute(scheduledFor));
  }, [scheduledFor]);

  useEffect(() => {
    if (!hourDraft.trim() || !minuteDraft.trim()) return;
    if (hourDraft.length < 2 || minuteDraft.length < 2) return;

    const currentHour = formatHour(scheduledFor);
    const currentMinute = formatMinute(scheduledFor);

    if (hourDraft === currentHour && minuteDraft === currentMinute) return;

    const timeout = setTimeout(() => {
      commitTimeParts(hourDraft, minuteDraft);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [commitTimeParts, hourDraft, minuteDraft, scheduledFor]);

  const scheduledDateFromDraft = useMemo(
    () => getScheduledDateFromDraft(scheduledFor, hourDraft, minuteDraft),
    [scheduledFor, hourDraft, minuteDraft],
  );

  const scheduleInvalid =
    deliveryMode === "schedule" &&
    (!scheduledDateFromDraft ||
      !isFutureDate(scheduledDateFromDraft) ||
      !!timeError);

  return {
    scheduledFor,
    setScheduledFor,

    hourDraft,
    minuteDraft,

    timeError,
    setTimeError,

    browserTimeZone,
    scheduledDateFromDraft,
    scheduleInvalid,

    commitTimeParts,
    handleHourChange,
    handleMinuteChange,
  };
}
