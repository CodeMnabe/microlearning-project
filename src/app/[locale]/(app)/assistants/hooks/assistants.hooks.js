"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";

import { ASSISTANT_UPLOADS_BUCKET } from "../lib/assistants.constants";

import {
  buildAssistantStoragePath,
  buildAssistantUpdatePayload,
  buildCreateAssistantPayload,
  buildUploadedFilePayload,
  getEmptyCreateAssistantForm,
  getFirstAssistantId,
  hasVectorStoreFormData,
  normalizeAssistantsList,
  updateCreateAssistantForm,
} from "../lib/assistants.helpers";

/**
 * Hook principal da camada Assistants.
 *
 * Gere:
 * - autenticação do utilizador atual;
 * - organização ativa do utilizador;
 * - carregamento dos assistentes da organização;
 * - seleção e carregamento do assistente ativo;
 * - edição local dos dados do assistente;
 * - gravação das alterações via API;
 * - remoção de assistentes;
 * - criação de novos assistentes;
 * - criação e remoção de vector stores;
 * - upload de ficheiros para Supabase Storage;
 * - estados de loading, saving, modal e formulário.
 *
 * Este hook coordena a feature no frontend.
 *
 * Não deve:
 * - renderizar JSX;
 * - conter markup visual;
 * - conter helpers puros inline quando estes podem estar em lib/;
 * - falar diretamente com tabelas da base de dados.
 *
 */

export function useAssistantsHub({
  translation,
  confirm,
  showAlert,
  startLoading,
  stopLoading,
}) {
  // Auth e organização atual
  const { user, loading: authLoading, supabase } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const orgId = org?.id || null;

  // Estado principal da lista e seleção de assistentes
  const [assistants, setAssistants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  // Estado de edição do assistente selecionado
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estado da vector store associada ao assistente
  const [vectorStore, setVectorStore] = useState(null);
  const [vsName, setVsName] = useState("");
  const [vsFiles, setVsFiles] = useState([]);

  // Estado do modal de criação de assistente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(getEmptyCreateAssistantForm);
  const [isCreating, setIsCreating] = useState(false);

  const showError = useCallback(
    async (message) => {
      if (showAlert) {
        await showAlert({
          title: "Erro",
          message,
          tone: "danger",
        });
        return;
      }

      alert(message);
    },
    [showAlert],
  );


  /**
   * Carrega todos os assistentes da organização atual.
   *
   * Também pode selecionar automaticamente o primeiro assistente da lista,
   * útil após criar ou apagar assistentes.
   */
  const fetchAssistants = useCallback(
    async ({ selectFirst = false } = {}) => {
      if (!orgId) return [];

      const res = await fetch(`/api/assistants?orgId=${orgId}`);
      const data = await res.json().catch(() => []);
      const list = normalizeAssistantsList(data);

      setAssistants(list);

      setSelectedId((currentId) => {
        if (selectFirst || (!currentId && list.length)) {
          return getFirstAssistantId(list);
        }

        return currentId;
      });

      return list;
    },
    [orgId],
  );

/**
 * Carrega os detalhes de um assistente específico.
 *
 * Se o assistente tiver vector store associada,
 * carrega também a coleção de documentos dessa store.
 */
  const fetchAssistant = useCallback(
    async (id) => {
      if (!id) return;

      startLoading();
      setSelected(null);
      setVectorStore(null);

      try {
        const res = await fetch(`/api/assistants/${id}`);
        const data = await res.json();

        setSelected(data);

        if (data?.vectorStoreId) {
          const storeRes = await fetch(
            `/api/assistants/${id}/vector-store/${data.vectorStoreId}`,
          );

          const store = await storeRes.json();
          setVectorStore(store);
        }
      } catch (error) {
        console.error(error);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    let alive = true;

    async function loadAssistants() {
      try {
        await fetchAssistants();
      } catch (error) {
        console.error(error);
      } finally {
        if (alive) stopLoading();
      }
    }

    loadAssistants();

    return () => {
      alive = false;
    };
  }, [authLoading, orgLoading, orgId, fetchAssistants, stopLoading]);

  useEffect(() => {
    if (!selectedId) return;

    fetchAssistant(selectedId);
  }, [selectedId, fetchAssistant]);

  function openCreateModal() {
    if (!orgId) return;

    setIsModalOpen(true);
  }

  function closeCreateModal() {
    setIsModalOpen(false);
  }


  function handleCreateFormChange(field, value) {
    setCreateForm((prev) => updateCreateAssistantForm(prev, field, value));
  }

  /**
 * Cria um novo assistente através da API.
 *
 * Depois de criar:
 * - limpa o formulário;
 * - fecha o modal;
 * - recarrega a lista de assistentes;
 * - seleciona o primeiro assistente da lista.
 */

  async function handleCreateAssistant(event) {
    event.preventDefault();

    if (!orgId) return;

    setIsCreating(true);

    try {
      const res = await fetch("/api/assistants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildCreateAssistantPayload(orgId, createForm)),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        await showError(payload.error || "Erro ao criar assistente.");
        return;
      }

      setCreateForm(getEmptyCreateAssistantForm());
      setIsModalOpen(false);

      await fetchAssistants({ selectFirst: true });
    } finally {
      setIsCreating(false);
    }
  }

  function selectAssistant(id) {
    setIsEditing(false);
    setDraft(null);
    setSelectedId(id);
  }

  function startEditing() {
    setDraft(selected ? { ...selected } : null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setDraft(null);
  }

  function handleFieldChange(field, value) {
    if (isEditing) {
      setDraft((prev) => ({
        ...(prev || {}),
        [field]: value,
      }));

      return;
    }

    setSelected((prev) => ({
      ...(prev || {}),
      [field]: value,
    }));
  }

  /**
 * Guarda alterações do assistente selecionado.
 *
 * Usa o draft local para construir o payload enviado à API.
 * Após guardar, volta a carregar os dados atualizados do assistente.
 */

  async function handleSave() {
    if (!selected || !draft) return;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/assistants/${selected.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildAssistantUpdatePayload(selected, draft)),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        await showError(payload.error || res.statusText);
        return;
      }

      setIsEditing(false);
      setDraft(null);

      await fetchAssistant(selected.id);
    } finally {
      setIsSaving(false);
    }
  }

  /**
 * Remove o assistente selecionado.
 *
 * Antes de apagar, pede confirmação ao utilizador.
 * Depois de apagar, atualiza a lista local e seleciona outro assistente,
 * se ainda existir algum.
 */
  async function deleteAssistant() {
    if (!selected) return;

    const ok = await confirm({
      title: translation("Delete.namedTitle", { name: selected.name }),
      message: translation("Delete.deleteMessage"),
      confirmText: translation("Common.delete"),
      cancelText: translation("Common.cancel"),
      tone: "danger",
    });

    if (!ok) return;

    startLoading();

    try {
      const res = await fetch(`/api/assistants/${selected.id}`, {
        method: "DELETE",
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        await showError(payload.error || res.statusText);
        return;
      }

      const remaining = assistants.filter(
        (assistant) => assistant.id !== selected.id,
      );

      setAssistants(remaining);
      setSelected(null);
      setSelectedId(getFirstAssistantId(remaining));
    } finally {
      stopLoading();
    }
  }

  function handleVectorStoreFilesChange(files) {
    setVsFiles(Array.from(files || []));
  }

  /**
 * Cria uma vector store para o assistente selecionado.
 *
 * Fluxo:
 * - envia os ficheiros para Supabase Storage;
 * - normaliza os dados dos ficheiros enviados;
 * - envia esses dados para a API criar a vector store;
 * - limpa o formulário local;
 * - recarrega o assistente atualizado.
 */

  async function handleAddVectorStore() {
    if (!selected || !hasVectorStoreFormData(vsName, vsFiles)) return;

    startLoading();

    try {
      const timestamp = Date.now();
      const uploaded = [];

      for (const file of vsFiles) {
        const path = buildAssistantStoragePath({
          orgId,
          assistantId: selected.id,
          fileName: file.name,
          timestamp,
        });

        const { error } = await supabase.storage
          .from(ASSISTANT_UPLOADS_BUCKET)
          .upload(path, file, {
            upsert: true,
            contentType: file.type || "application/octet-stream",
          });

        if (error) {
          await showError(`Erro no upload: ${error.message}`);
          return;
        }

        uploaded.push(
          buildUploadedFilePayload({
            bucket: ASSISTANT_UPLOADS_BUCKET,
            path,
            file,
          }),
        );
      }

      const res = await fetch(`/api/assistants/${selected.id}/vector-store`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeName: vsName,
          files: uploaded,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        await showError(data.error || "Falha ao criar a store.");
        return;
      }

      setVsName("");
      setVsFiles([]);

      await fetchAssistant(selected.id);
    } finally {
      stopLoading();
    }
  }

  /**
 * Remove a vector store associada ao assistente selecionado.
 *
 * Antes de apagar, pede confirmação ao utilizador.
 * Depois de apagar, recarrega o assistente para refletir a alteração.
 */

  async function deleteVectorStore() {
    if (!selected || !selected.vectorStoreId) return;

    const ok = await confirm({
      title: translation("Delete.title"),
      message: translation("Delete.deleteMessage"),
      confirmText: translation("Common.delete"),
      cancelText: translation("Common.cancel"),
      tone: "danger",
    });

    if (!ok) return;

    startLoading();

    try {
      const res = await fetch(
        `/api/assistants/${selected.id}/vector-store/${selected.vectorStoreId}`,
        {
          method: "DELETE",
        },
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        await showError(payload.message || res.statusText);
        return;
      }

      await fetchAssistant(selected.id);
    } finally {
      stopLoading();
    }
  }

  return {
    authLoading,
    orgLoading,
    orgId,

    assistants,
    selectedId,
    selected,
    selectAssistant,

    isEditing,
    draft,
    isSaving,
    startEditing,
    cancelEditing,
    handleFieldChange,
    handleSave,
    deleteAssistant,

    vectorStore,
    vsName,
    setVsName,
    vsFiles,
    handleVectorStoreFilesChange,
    handleAddVectorStore,
    deleteVectorStore,

    isModalOpen,
    openCreateModal,
    closeCreateModal,
    createForm,
    isCreating,
    handleCreateFormChange,
    handleCreateAssistant,
  };
}