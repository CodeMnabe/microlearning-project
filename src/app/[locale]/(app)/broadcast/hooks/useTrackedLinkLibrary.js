"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTrackedLinkLibrary } from "../lib/broadcast.api";

/**
 * Links rastreados já usados pela organização. Carrega cada vez que o
 * painel dos links abre (`enabled`), para apanhar os do envio mais recente.
 */
export default function useTrackedLinkLibrary({ orgId, enabled }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !orgId) return undefined;

    let cancelled = false;

    setLoading(true);
    setFailed(false);

    fetchTrackedLinkLibrary(orgId)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, loading, failed, reload };
}
