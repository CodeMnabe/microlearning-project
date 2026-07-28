"use client";

import { useMemo, useState } from "react";

import { filterBroadcastUsers, normalizeBroadcastUsers } from "../lib";
/**
 * Gere destinatários e filtros do Broadcast.
 *
 * Responsabilidades:
 * - guardar a lista de utilizadores carregados;
 * - controlar pesquisa, tags e assistentes selecionados;
 * - normalizar utilizadores para o formato usado pela UI;
 * - calcular destinatários selecionados;
 * - aplicar filtros por canal, pesquisa, tags e assistentes;
 * - selecionar ou desselecionar destinatários individualmente ou em lote.
 */

export function useBroadcastRecipients({ channel }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [allTags, setAllTags] = useState([]);
  const [assistantsList, setAssistantsList] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedAssistantIds, setSelectedAssistantIds] = useState([]);

  const activeFilterCount = selectedTagIds.length + selectedAssistantIds.length;

  const normalizedUsers = useMemo(
    () => normalizeBroadcastUsers(users),
    [users],
  );

  const selectedUsers = useMemo(
    () => normalizedUsers.filter((user) => selected.has(user.id)),
    [normalizedUsers, selected],
  );

  const filtered = useMemo(
    () =>
      filterBroadcastUsers({
        users: normalizedUsers,
        query: q,
        selectedTagIds,
        selectedAssistantIds,
        channel,
      }),
    [normalizedUsers, q, selectedTagIds, selectedAssistantIds, channel],
  );

  const allOnPageSelected = useMemo(
    () =>
      filtered.length > 0 && filtered.every((user) => selected.has(user.id)),
    [filtered, selected],
  );

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllCurrent() {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = filtered.map((user) => user.id);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));

      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  return {
    users,
    setUsers,

    q,
    setQ,

    selected,
    setSelected,

    allTags,
    setAllTags,

    assistantsList,
    setAssistantsList,

    filterOpen,
    setFilterOpen,

    selectedTagIds,
    setSelectedTagIds,

    selectedAssistantIds,
    setSelectedAssistantIds,

    activeFilterCount,
    normalizedUsers,
    selectedUsers,
    filtered,
    allOnPageSelected,

    toggleOne,
    toggleAllCurrent,
  };
}
