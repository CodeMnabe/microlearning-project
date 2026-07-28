"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";

import { CHANNEL_OPTIONS, STATUS_OPTIONS } from "../lib/scheduled.constants";

import { normalizeUser, uniqueRecipients } from "../lib/recipient.helpers";

import {
  buildScheduledEditPayload,
  buildScheduledIso,
  canDeleteItem,
  normalizeBroadcast,
  toDateInputValue,
} from "../lib/scheduled.helpers";

import {
  deleteScheduledBroadcast,
  fetchOrgUsers,
  fetchScheduledBroadcasts,
  updateScheduledBroadcast,
} from "../lib/scheduled.api";

/**
 * Tempo de espera antes de limpar o item selecionado ao fechar um modal.
 *
 * Corresponde à duração da animação de saída: se o item fosse limpo de
 * imediato, o modal ficaria sem dados a meio do fecho.
 */
const MODAL_CLOSE_MS = 280;

/**
 * Hook principal da página de broadcasts agendados.
 *
 * Gere:
 * - organização ativa e carregamento dos agendamentos;
 * - carregamento dos utilizadores usados na edição de destinatários;
 * - pesquisa e filtros por estado, canal e data;
 * - estatísticas da lista;
 * - abertura e fecho dos modais de detalhe e de edição;
 * - gravação e remoção de agendamentos;
 * - alertas e confirmações associados a estas operações.
 *
 * Não deve:
 * - renderizar JSX;
 * - conhecer classes de CSS;
 * - construir URLs ou tratar respostas HTTP.
 */
export function useScheduledBroadcasts() {
  const translation = useTranslations("BroadcastScheduled");
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);

  const confirm = useConfirm();
  const showAlert = useAlert();

  /**
   * O alerta é guardado numa referência para que os efeitos de carregamento
   * não voltem a correr quando a identidade da função muda.
   */
  const showAlertRef = useRef(showAlert);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orgUsers, setOrgUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("scheduled");
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const closeTimersRef = useRef({ view: null, edit: null });

  /* ---------------------------------------------------------------------- */
  /* Carregamento de dados                                                  */
  /* ---------------------------------------------------------------------- */

  const loadItems = useCallback(
    async (showSuccessAlert = false) => {
      if (!org?.id) {
        if (showSuccessAlert) {
          await showAlertRef.current({
            title: translation("Alerts.noOrg.title"),
            message: translation("Alerts.noOrg.message"),
            tone: "warning",
          });
        }

        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await fetchScheduledBroadcasts(org.id);

        setItems((result?.items ?? []).map(normalizeBroadcast));
      } catch (err) {
        console.warn("[Scheduled] load items error:", err);

        setError(translation("Errors.load"));

        await showAlertRef.current({
          title: translation("Alerts.loadError.title"),
          message: translation("Alerts.loadError.message"),
          tone: "danger",
        });
      } finally {
        setLoading(false);
      }
    },
    [org?.id, translation],
  );

  useEffect(() => {
    if (orgLoading) return;

    if (!org?.id) {
      setLoading(false);
      return;
    }

    loadItems();
  }, [org?.id, orgLoading, loadItems]);

  useEffect(() => {
    if (!org?.id) return;

    let cancelled = false;

    (async () => {
      setUsersLoading(true);

      try {
        const result = await fetchOrgUsers(org.id);

        if (cancelled) return;

        const list = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result)
            ? result
            : [];

        setOrgUsers(list.map(normalizeUser));
      } catch (err) {
        console.warn("[Scheduled] load users error:", err);

        if (!cancelled) {
          setOrgUsers([]);

          await showAlertRef.current({
            title: translation("Alerts.usersLoadError.title"),
            message: translation("Alerts.usersLoadError.message"),
            tone: "danger",
          });
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [org?.id, translation]);

  useEffect(() => {
    const timers = closeTimersRef.current;

    return () => {
      if (timers.view) clearTimeout(timers.view);
      if (timers.edit) clearTimeout(timers.edit);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Dados derivados                                                        */
  /* ---------------------------------------------------------------------- */

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.message.toLowerCase().includes(query) ||
        item.channel.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query) ||
        String(item.createdBy ?? "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesChannel =
        channelFilter === "all" || item.channel === channelFilter;
      const matchesDate =
        !dateFilter || toDateInputValue(item.scheduledFor) === dateFilter;

      return matchesSearch && matchesStatus && matchesChannel && matchesDate;
    });
  }, [items, search, statusFilter, channelFilter, dateFilter]);

  const stats = useMemo(
    () => ({
      total: items.length,
      scheduled: items.filter((item) => item.status === "scheduled").length,
      sending: items.filter((item) => item.status === "sending").length,
      failed: items.filter((item) => item.status === "failed").length,
    }),
    [items],
  );

  const channelOptions = useMemo(
    () =>
      CHANNEL_OPTIONS.map((option) => ({
        value: option,
        label: translation(`Channels.${option}`),
      })),
    [translation],
  );

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => ({
        value: option,
        label: translation(`Statuses.${option}`),
      })),
    [translation],
  );

  /* ---------------------------------------------------------------------- */
  /* Modais                                                                 */
  /* ---------------------------------------------------------------------- */

  function openViewModal(item) {
    if (closeTimersRef.current.view) {
      clearTimeout(closeTimersRef.current.view);
    }

    setSelectedItem(item);
    setIsViewModalOpen(true);
  }

  function closeViewModal() {
    setIsViewModalOpen(false);

    if (closeTimersRef.current.view) {
      clearTimeout(closeTimersRef.current.view);
    }

    closeTimersRef.current.view = setTimeout(() => {
      setSelectedItem(null);
    }, MODAL_CLOSE_MS);
  }

  function openEditModal(item) {
    if (closeTimersRef.current.edit) {
      clearTimeout(closeTimersRef.current.edit);
    }

    setEditingItem(item);
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);

    if (closeTimersRef.current.edit) {
      clearTimeout(closeTimersRef.current.edit);
    }

    closeTimersRef.current.edit = setTimeout(() => {
      setEditingItem(null);
    }, MODAL_CLOSE_MS);
  }

  /* ---------------------------------------------------------------------- */
  /* Ações                                                                  */
  /* ---------------------------------------------------------------------- */

  async function handleSaveEdit(formData) {
    if (!editingItem) return;

    const scheduledIso = buildScheduledIso(
      formData.date,
      formData.hour,
      formData.minute,
    );

    const recipients = uniqueRecipients(formData.recipients, formData.channel);

    if (!formData.message.trim() || !scheduledIso) {
      setError(translation("Errors.invalidForm"));

      await showAlert({
        title: translation("Alerts.invalidForm.title"),
        message: translation("Alerts.invalidForm.message"),
        tone: "warning",
      });

      return;
    }

    if (!recipients.length) {
      setError(translation("Errors.invalidForm"));

      await showAlert({
        title: translation("Alerts.invalidForm.title"),
        message: "Choose at least one recipient.",
        tone: "warning",
      });

      return;
    }

    setSaving(true);
    setError("");

    try {
      const nextPayload = buildScheduledEditPayload({
        previousPayload: editingItem.payload,
        formData,
        recipients,
      });

      const result = await updateScheduledBroadcast(editingItem.id, {
        channel: formData.channel,
        scheduled_for: scheduledIso,
        timezone: formData.timezone.trim() || "Europe/Lisbon",
        status: formData.status === "scheduled" ? "queued" : formData.status,
        payload: nextPayload,
        recipient_count: recipients.length,
      });

      const normalized = normalizeBroadcast(result.item);

      setItems((prev) =>
        prev.map((item) => (item.id === normalized.id ? normalized : item)),
      );

      closeEditModal();

      await showAlert({
        title: translation("Alerts.saveSuccess.title"),
        message: translation("Alerts.saveSuccess.message"),
        tone: "success",
      });
    } catch (err) {
      console.warn("[Scheduled] save edit error:", err);

      setError(translation("Errors.save"));

      await showAlert({
        title: translation("Alerts.saveError.title"),
        message: translation("Alerts.saveError.message"),
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!canDeleteItem(item)) return;

    const confirmed = await confirm({
      title: translation("Delete.title"),
      message: translation("Delete.deleteMessage"),
      confirmText: translation("Delete.delete"),
      cancelText: translation("Delete.cancel"),
      tone: "danger",
    });

    if (!confirmed) return;

    setDeletingId(item.id);
    setError("");

    try {
      await deleteScheduledBroadcast(item.id);

      setItems((prev) => prev.filter((row) => row.id !== item.id));

      if (selectedItem?.id === item.id) {
        setIsViewModalOpen(false);
        setSelectedItem(null);
      }

      if (editingItem?.id === item.id) {
        setIsEditModalOpen(false);
        setEditingItem(null);
      }

      await showAlert({
        title: translation("Alerts.deleteSuccess.title"),
        message: translation("Alerts.deleteSuccess.message"),
        tone: "success",
      });
    } catch (err) {
      console.warn("[Scheduled] delete error:", err);

      setError(translation("Errors.delete"));

      await showAlert({
        title: translation("Alerts.deleteError.title"),
        message: translation("Alerts.deleteError.message"),
        tone: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return {
    // tradução e organização
    translation,
    org,

    // dados
    items,
    filteredItems,
    stats,
    orgUsers,
    usersLoading,
    loading,
    error,

    // pesquisa e filtros
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    channelFilter,
    setChannelFilter,
    dateFilter,
    setDateFilter,
    channelOptions,
    statusOptions,

    // modais
    selectedItem,
    editingItem,
    isViewModalOpen,
    isEditModalOpen,
    openViewModal,
    closeViewModal,
    openEditModal,
    closeEditModal,

    // ações
    loadItems,
    handleSaveEdit,
    handleDelete,
    saving,
    deletingId,
  };
}
