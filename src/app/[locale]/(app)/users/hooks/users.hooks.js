"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/app/AuthContext.jsx";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";

import {
  DEFAULT_PHONE_COUNTRY_CODE,
  DEFAULT_USERS_PAGE,
  DEFAULT_USERS_PAGE_SIZE,
  DEFAULT_USERS_VIEW,
  USERS_VIEW_STORAGE_KEY,
} from "../lib/users.constants";

import {
  buildAssistantsById,
  calculateUsersTotalPages,
  filterUsers,
  normalizeUsers,
} from "../lib/users.helpers";

import {
  createUser as createUserRequest,
  deleteUser as deleteUserRequest,
  fetchAssistants,
  fetchTags,
  fetchUsers,
  updateUser,
} from "../lib/users.api";

/**
 * Hook principal da camada Users.
 *
 * Gere:
 * - autenticação do utilizador atual e organização ativa;
 * - carregamento dos utilizadores, assistentes e tags da organização;
 * - pesquisa, filtros por tag e por assistente;
 * - paginação e vista selecionada;
 * - seleção de linhas para ações em massa;
 * - criação, edição, remoção e alteração de assistente;
 * - estado dos modais de criar, editar, ver, importar e gerir tags;
 * - alertas e confirmações associados a estas operações.
 *
 * Este hook coordena a feature no frontend.
 *
 * Não deve:
 * - renderizar JSX;
 * - conhecer classes de CSS;
 * - guardar referências a elementos do DOM;
 * - gerir estado puramente visual, como a abertura de um menu ou popover.
 */
export function useUsers() {
  const translation = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);

  const confirm = useConfirm();
  const showAlert = useAlert();
  const { startLoading, stopLoading } = useGlobalLoader();

  const [users, setUsers] = useState([]);
  const [assistantsList, setAssistantsList] = useState([]);
  const [allTags, setAllTags] = useState([]);

  const [query, setQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedAssistantIds, setSelectedAssistantIds] = useState([]);

  const [selected, setSelected] = useState(new Set());

  const [page, setPage] = useState(DEFAULT_USERS_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_USERS_PAGE_SIZE);
  const [totalUsers, setTotalUsers] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  // list | grid (persistida no localStorage)
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_USERS_VIEW;

    return localStorage.getItem(USERS_VIEW_STORAGE_KEY) || DEFAULT_USERS_VIEW;
  });

  /**
   * O alerta é guardado numa referência para que os efeitos de carregamento
   * não voltem a correr quando a identidade da função muda.
   */
  const showAlertRef = useRef(null);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  useEffect(() => {
    localStorage.setItem(USERS_VIEW_STORAGE_KEY, view);
  }, [view]);

  const orgId = org?.id;

  const defaultPhoneCode =
    org?.default_phone_country_code || DEFAULT_PHONE_COUNTRY_CODE;

  const totalPages = calculateUsersTotalPages(totalUsers, pageSize);

  /* ---------------------------------------------------------------------- */
  /* Carregamento de dados                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchAssistants(orgId);

        if (!alive) return;

        setAssistantsList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("[Users] assistants load error:", err);

        if (!alive) return;

        setAssistantsList([]);

        if (typeof showAlertRef.current === "function") {
          await showAlertRef.current({
            title: translation("Users.alerts.assistantsLoadFailed.title"),
            message: translation("Users.alerts.assistantsLoadFailed.message"),
            tone: "danger",
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, orgLoading, orgId, translation]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      try {
        const data = await fetchTags(orgId);

        if (!alive) return;

        setAllTags(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("[Users] tags load error:", err);

        if (!alive) return;

        setAllTags([]);

        if (typeof showAlertRef.current === "function") {
          await showAlertRef.current({
            title: translation("Users.alerts.tagsLoadFailed.title"),
            message: translation("Users.alerts.tagsLoadFailed.message"),
            tone: "danger",
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId, translation]);

  const refreshUsers = useCallback(
    async (showSuccessAlert = false) => {
      if (!orgId) {
        if (showSuccessAlert && typeof showAlertRef.current === "function") {
          await showAlertRef.current({
            title: translation("Users.alerts.noOrg.title"),
            message: translation("Users.alerts.noOrg.message"),
            tone: "warning",
          });
        }

        return;
      }

      startLoading();

      try {
        const data = await fetchUsers({ orgId, page, pageSize });

        setUsers(Array.isArray(data?.items) ? data.items : []);
        setTotalUsers(Number(data?.total || 0));

        if (showSuccessAlert && typeof showAlertRef.current === "function") {
          await showAlertRef.current({
            title: translation("Users.alerts.usersRefreshSuccess.title"),
            message: translation("Users.alerts.usersRefreshSuccess.message"),
            tone: "success",
          });
        }
      } catch (err) {
        console.warn("[Users] refresh users error:", err);

        setUsers([]);
        setTotalUsers(0);

        if (typeof showAlertRef.current === "function") {
          await showAlertRef.current({
            title: translation("Users.alerts.usersLoadFailed.title"),
            message: translation("Users.alerts.usersLoadFailed.message"),
            tone: "danger",
          });
        }
      } finally {
        stopLoading();
      }
    },
    [orgId, page, pageSize, startLoading, stopLoading, translation],
  );

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;
    refreshUsers();
  }, [authLoading, orgLoading, orgId, refreshUsers]);

  /* ---------------------------------------------------------------------- */
  /* Dados derivados                                                        */
  /* ---------------------------------------------------------------------- */

  const normalizedUsers = useMemo(() => normalizeUsers(users), [users]);

  const visibleUsers = useMemo(
    () =>
      filterUsers(normalizedUsers, query, selectedTagIds, selectedAssistantIds),
    [normalizedUsers, query, selectedTagIds, selectedAssistantIds],
  );

  const assistantsById = useMemo(
    () => buildAssistantsById(assistantsList),
    [assistantsList],
  );

  const activeFilterCount = selectedTagIds.length + selectedAssistantIds.length;

  /* ---------------------------------------------------------------------- */
  /* Seleção                                                                */
  /* ---------------------------------------------------------------------- */

  const visibleIds = visibleUsers.map((u) => u.id);

  const allChecked =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);

      if (allChecked) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));

      return next;
    });
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function clearFilters() {
    setSelectedTagIds([]);
    setSelectedAssistantIds([]);
  }

  function removeTagFilter(tagId) {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  }

  function removeAssistantFilter(assistantId) {
    setSelectedAssistantIds((prev) => prev.filter((id) => id !== assistantId));
  }

  /* ---------------------------------------------------------------------- */
  /* Ações                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Cria um utilizador.
   *
   * Devolve `{ ok, error }` porque o modal de criação depende deste
   * resultado para decidir se fecha e limpa o formulário.
   */
  async function handleCreateUser({
    userName,
    phoneCode,
    phoneNational,
    email,
    assistantId,
    teamsAadObjectId,
    teamsFromId,
  }) {
    if (!orgId) {
      await showAlert({
        title: translation("Users.alerts.noOrg.title"),
        message: translation("Users.alerts.noOrg.message"),
        tone: "warning",
      });

      return {
        ok: false,
        error: translation("Users.alerts.noOrg.message"),
      };
    }

    try {
      await createUserRequest({
        organizationId: orgId,
        name: userName,
        email: email || null,
        assistantId,
        phoneCountryCode: phoneCode,
        phoneNational,
        teamsAadObjectId: teamsAadObjectId || null,
        teamsFromId: teamsFromId || null,
      });

      await refreshUsers();
      setIsCreateOpen(false);

      return { ok: true };
    } catch (err) {
      console.warn("[Users] create user error:", err);

      await showAlert({
        title: translation("Users.alerts.createUserFailed.title"),
        message: translation("Users.alerts.createUserFailed.message"),
        tone: "danger",
      });

      return {
        ok: false,
        error: err?.message || "Failed to create user.",
      };
    }
  }

  async function deleteUserById(targetUser) {
    const ok = await confirm({
      title: translation("Users.confirmDeleteTitle", { name: targetUser.name }),
      message: translation("Users.confirmDeleteMessage"),
      confirmText: translation("Common.delete"),
      cancelText: translation("Common.cancel"),
      tone: "danger",
    });

    if (!ok) return;

    try {
      await deleteUserRequest(targetUser.id);

      await refreshUsers();

      await showAlert({
        title: translation("Users.alerts.userDeleted.title"),
        message: translation("Users.alerts.userDeleted.message", {
          name: targetUser.name,
        }),
        tone: "success",
      });
    } catch (err) {
      console.warn("[Users] delete user error:", err);

      await showAlert({
        title: translation("Users.alerts.deleteUserFailed.title"),
        message: translation("Users.alerts.deleteUserFailed.message"),
        tone: "danger",
      });
    }
  }

  async function handleUserAssistantChange(targetUser, newAssistantId) {
    try {
      await updateUser({
        id: targetUser.id,
        assistantId: newAssistantId,
      });

      await refreshUsers();

      await showAlert({
        title: translation("Users.alerts.assistantUpdated.title"),
        message: translation("Users.alerts.assistantUpdated.message", {
          name: targetUser.name,
        }),
        tone: "success",
      });
    } catch (err) {
      console.warn("[Users] update assistant error:", err);

      await showAlert({
        title: translation("Users.alerts.assistantUpdateFailed.title"),
        message: translation("Users.alerts.assistantUpdateFailed.message"),
        tone: "danger",
      });
    }
  }

  async function openCreateModal() {
    if (!orgId) {
      await showAlert({
        title: translation("Users.alerts.noOrg.title"),
        message: translation("Users.alerts.noOrg.message"),
        tone: "warning",
      });

      return;
    }

    setIsCreateOpen(true);
  }

  function openEditModal(targetUser) {
    setEditingUser(targetUser);
    setEditOpen(true);
  }

  function openViewModal(targetUser) {
    setViewingUser(targetUser);
    setViewOpen(true);
  }

  /**
   * Passa do modal de detalhe para o modal de edição, mantendo
   * o utilizador selecionado.
   */
  function editFromView() {
    setViewOpen(false);

    if (viewingUser) {
      setEditingUser(viewingUser);
      setEditOpen(true);
    }
  }

  /**
   * Recarrega a lista depois de uma edição.
   *
   * O modal de edição envia o utilizador atualizado, mas aqui só interessa
   * o refresh. O argumento é ignorado de propósito, para não ser confundido
   * com o `showSuccessAlert` do `refreshUsers`.
   */
  async function handleUserSaved() {
    await refreshUsers();
  }

  async function handleImported() {
    await refreshUsers();

    await showAlert({
      title: translation("Users.alerts.importSuccess.title"),
      message: translation("Users.alerts.importSuccess.message"),
      tone: "success",
    });
  }

  function goToPreviousPage() {
    setPage((current) => Math.max(1, current - 1));
  }

  function goToNextPage() {
    setPage((current) => Math.min(totalPages, current + 1));
  }

  function changePageSize(newPageSize) {
    setPageSize(Number(newPageSize));
    setPage(1);
  }

  return {
    // organização e estados de carregamento
    authLoading,
    orgLoading,
    org,
    orgId,
    defaultPhoneCode,

    // dados
    assistantsList,
    assistantsById,
    allTags,
    setAllTags,
    visibleUsers,

    // pesquisa e filtros
    query,
    setQuery,
    selectedTagIds,
    setSelectedTagIds,
    selectedAssistantIds,
    setSelectedAssistantIds,
    activeFilterCount,
    clearFilters,
    removeTagFilter,
    removeAssistantFilter,

    // seleção
    selected,
    selectedIds,
    selectedCount: selected.size,
    allChecked,
    toggleAll,
    toggleOne,
    clearSelection,

    // paginação
    page,
    pageSize,
    totalUsers,
    totalPages,
    goToPreviousPage,
    goToNextPage,
    changePageSize,

    // vista
    view,
    setView,

    // modais
    isCreateOpen,
    setIsCreateOpen,
    isTagsOpen,
    setIsTagsOpen,
    isImportOpen,
    setIsImportOpen,
    editOpen,
    setEditOpen,
    editingUser,
    viewOpen,
    setViewOpen,
    viewingUser,
    openCreateModal,
    openEditModal,
    openViewModal,
    editFromView,

    // ações
    refreshUsers,
    handleCreateUser,
    deleteUserById,
    handleUserAssistantChange,
    handleUserSaved,
    handleImported,
  };
}
