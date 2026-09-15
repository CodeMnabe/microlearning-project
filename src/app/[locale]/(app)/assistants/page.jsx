// /app/[locale]/(app)/assistants/page.js
"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./assistants.module.css";
import CreateAssistantModal from "./CreateAssistantModal";
import ChatSandbox from "./Chatbox/Chatbox.jsx";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import Slider from "@/app/components/Slider/Slider";

const STORAGE_BUCKET = "assistant-uploads";

export default function AssistantsHub() {
  const translation = useTranslations();
  const confirm = useConfirm();
  const { user, loading: authLoading, supabase } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const orgId = org?.id || null;

  const { startLoading, stopLoading } = useGlobalLoader();
  const [assistants, setAssistants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  // editing state
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // vector store state
  const [vectorStore, setVectorStore] = useState(null);
  const [vsName, setVsName] = useState("");
  const [vsFiles, setVsFiles] = useState([]);
  const [isEditingVectorStore, setIsEditingVectorStore] = useState(false);
  const [vectorStoreDraftName, setVectorStoreDraftName] = useState("");
  const [vectorStoreEditFiles, setVectorStoreEditFiles] = useState([]);
  const [removedVectorFileIds, setRemovedVectorFileIds] = useState([]);
  const [isSavingVectorStore, setIsSavingVectorStore] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1) fetch assistants when auth/org are ready
  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/assistants?orgId=${orgId}`);
        const data = await res.json().catch(() => []);
        if (!alive) return;

        const list = Array.isArray(data) ? data : [];
        setAssistants(list);
        if (!selectedId && list.length) setSelectedId(list[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) stopLoading();
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, orgLoading, orgId, selectedId, stopLoading]);

  // 2) fetch details of current assistant
  const fetchOne = useCallback(
    async (id) => {
      if (!id) return;
      let alive = true;
      startLoading();
      setSelected(null);
      setVectorStore(null);
      setIsEditingVectorStore(false);
      setVectorStoreDraftName("");
      setVectorStoreEditFiles([]);
      setRemovedVectorFileIds([]);

      try {
        const res = await fetch(`/api/assistants/${id}`);
        const data = await res.json();
        if (!alive) return;
        setSelected(data);

        if (data && data.vectorStoreId) {
          const r = await fetch(
            `/api/assistants/${id}/vector-store/${data.vectorStoreId}`,
          );
          const store = await r.json();
          if (!alive) return;
          setVectorStore(store);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  useEffect(() => {
    if (selectedId) fetchOne(selectedId);
  }, [selectedId, fetchOne]);

  function openCreate() {
    if (!orgId) return;
    setIsModalOpen(true);
  }

  async function handleAssistantCreated() {
    if (!orgId) {
      setIsModalOpen(false);
      return;
    }
    const updated = await fetch(`/api/assistants?orgId=${orgId}`)
      .then((r) => r.json())
      .catch(() => []);
    const list = Array.isArray(updated) ? updated : [];
    setAssistants(list);
    const newest = list[list.length - 1];
    setSelectedId(newest ? newest.id : null);
    setIsModalOpen(false);
  }

  // unified field changer — writes to draft while editing
  function handleChange(field, value) {
    if (isEditing) {
      setDraft((prev) => ({ ...(prev || {}), [field]: value }));
    } else {
      setSelected((prev) => ({ ...(prev || {}), [field]: value }));
    }
  }

  // save applies the draft
  async function handleSave() {
    if (!selected || !draft) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assistants/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          instructions: draft.instructions,
          model: draft.model,
          temperature: draft.temperature,
          top_p: draft.top_p,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert("Erro ao guardar: " + (payload.error || res.statusText));
        return;
      }
      setIsEditing(false);
      setDraft(null);
      await fetchOne(selected.id);
    } finally {
      setIsSaving(false);
    }
  }

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
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert("Erro: " + (payload.error || res.statusText));
        return;
      }
      const remaining = assistants.filter((a) => a.id !== selected.id);
      setAssistants(remaining);
      setSelected(null);
      setSelectedId(remaining[0] ? remaining[0].id : null);
    } finally {
      stopLoading();
    }
  }

  async function stageFiles(files) {
    const basePath = `${orgId}/${selected.id}/${Date.now()}`;
    const uploaded = [];

    for (const f of files) {
      const path = `${basePath}-${f.name}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, f, {
          upsert: true,
          contentType: f.type || "application/octet-stream",
        });

      if (error) {
        throw new Error("Erro no upload: " + error.message);
      }

      uploaded.push({
        bucket: STORAGE_BUCKET,
        path,
        name: f.name,
        size: f.size,
        type: f.type,
      });
    }

    return uploaded;
  }

  async function handleAddVectorStore() {
    if (!selected) return;
    if (!vsName.trim() || vsFiles.length === 0) return;

    startLoading();
    try {
      const uploaded = await stageFiles(vsFiles);

      const res = await fetch(`/api/assistants/${selected.id}/vector-store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName: vsName, files: uploaded }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Erro: " + (data.error || "Falha ao criar a store"));
        return;
      }
      setVsName("");
      setVsFiles([]);
      await fetchOne(selected.id);
    } catch (error) {
      alert(error?.message || "Erro ao carregar os ficheiros");
    } finally {
      stopLoading();
    }
  }

  function beginVectorStoreEdit() {
    if (!vectorStore) return;

    setVectorStoreDraftName(vectorStore.storeName || "");
    setVectorStoreEditFiles([]);
    setRemovedVectorFileIds([]);
    setIsEditingVectorStore(true);
  }

  function toggleVectorFileRemoval(fileId) {
    const normalizedId = Number(fileId);

    setRemovedVectorFileIds((previous) =>
      previous.includes(normalizedId)
        ? previous.filter((id) => id !== normalizedId)
        : [...previous, normalizedId],
    );
  }

  function cancelVectorStoreEdit() {
    setIsEditingVectorStore(false);
    setVectorStoreDraftName("");
    setVectorStoreEditFiles([]);
    setRemovedVectorFileIds([]);
  }

  async function handleUpdateVectorStore() {
    if (!selected || !vectorStore || !selected.vectorStoreId) return;

    if (!vectorStoreDraftName.trim()) return;

    setIsSavingVectorStore(true);
    startLoading();

    try {
      const uploaded = await stageFiles(vectorStoreEditFiles);
      const res = await fetch(
        `/api/assistants/${selected.id}/vector-store/${selected.vectorStoreId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeName: vectorStoreDraftName.trim(),
            files: uploaded,
            removedFileIds: removedVectorFileIds,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert("Erro: " + (data.error || "Falha ao atualizar a coleção"));
        return;
      }

      cancelVectorStoreEdit();
      await fetchOne(selected.id);
    } catch (error) {
      alert(error?.message || "Erro ao atualizar a coleção");
    } finally {
      setIsSavingVectorStore(false);
      stopLoading();
    }
  }

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
        { method: "DELETE" },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert("Erro: " + (payload.message || res.statusText));
        return;
      }
      await fetchOne(selected.id);
    } finally {
      stopLoading();
    }
  }

  // helpers to read either draft (editing) or selected (read-only)
  const read = (key, fallback = "") =>
    (isEditing ? draft?.[key] : selected?.[key]) ?? fallback;

  return (
    <div className={styles.hub}>
      {/* LEFT LIST */}
      <aside className={styles.listCol}>
        <div className={styles.listHeader}>
          <span>{translation("Assistants.myAssistants")}</span>
        </div>

        <div className={styles.list}>
          {assistants.map((a) => (
            <button
              key={a.id}
              className={`${styles.listItem} ${
                a.id === selectedId ? styles.listItemActive : ""
              }`}
              onClick={() => {
                setIsEditing(false);
                setDraft(null);
                setSelectedId(a.id);
              }}
            >
              <span className={styles.listItemName}>{a.name}</span>
            </button>
          ))}

          {!assistants.length && (
            <div className={styles.emptyState}>
              <p>{translation("Assistants.empty")}</p>
            </div>
          )}
        </div>

        <div className={styles.listFooter}>
          <button
            className={styles.ctaPrimary}
            onClick={openCreate}
            disabled={!orgId}
            title={translation("Assistants.createAssistant")}
          >
            {translation("Assistants.createAssistant")}
          </button>
        </div>
      </aside>

      {/* CENTER */}
      <section className={styles.mainCol}>
        {selected ? (
          <>
            {/* Keep the blue card; only invert inputs when editing */}
            <section
              className={`${styles.card} ${styles.primaryCard} ${
                isEditing ? styles.editing : ""
              }`}
            >
              <div className={styles.cardTitleRow}>
                {isEditing ? (
                  <input
                    className={styles.inputTitle}
                    value={read("name")}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                ) : (
                  <h2 className={styles.cardTitle}>{selected.name}</h2>
                )}
              </div>

              {isEditing ? (
                <>
                  <input
                    className={styles.inputSub}
                    value={read("description")}
                    maxLength={80}
                    onChange={(e) =>
                      handleChange("description", e.target.value)
                    }
                    placeholder={translation(
                      "Assistants.details.descriptionPlaceholder",
                    )}
                  />
                  <textarea
                    className={styles.instructionsInput}
                    value={read("instructions")}
                    onChange={(e) =>
                      handleChange("instructions", e.target.value)
                    }
                    placeholder={translation(
                      "Assistants.details.instructionsPlaceholder",
                    )}
                  />
                </>
              ) : (
                <>
                  <p className={styles.subdued}>{selected.description}</p>
                  <div className={styles.instructionsPaper}>
                    {selected.instructions}
                  </div>
                </>
              )}

              <div className={styles.specBadge}>
                {translation("Assistants.details.specs")}
              </div>

              <div className={styles.specs}>
                {/* Creativity */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>
                    {translation("Assistants.details.creativity")}
                  </span>

                  {isEditing ? (
                    <div className={styles.sliderRowEditing}>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={read("top_p", 0)}
                        onChange={(e) =>
                          handleChange("top_p", parseFloat(e.target.value))
                        }
                      />
                      <span className={styles.sliderValueRight}>
                        {(read("top_p", 0) || 0).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.specTrack}>
                        <div
                          className={styles.specFill}
                          style={{ width: `${(selected.top_p || 0) * 100}%` }}
                        />
                      </div>
                      <span className={styles.specValue}>
                        {(selected.top_p || 0).toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                {/* Variety */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>
                    {translation("Assistants.details.variety")}
                  </span>

                  {isEditing ? (
                    <div className={styles.sliderRowEditing}>
                      <Slider
                        min={0}
                        max={2}
                        step={0.01}
                        value={read("temperature", 0)}
                        onChange={(e) =>
                          handleChange(
                            "temperature",
                            parseFloat(e.target.value),
                          )
                        }
                      />
                      <span className={styles.sliderValueRight}>
                        {(read("temperature", 0) || 0).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.specTrack}>
                        <div
                          className={styles.specFill}
                          style={{
                            width: `${
                              Math.min((selected.temperature || 0) / 2, 1) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className={styles.specValue}>
                        {(selected.temperature || 0).toFixed(0)}
                      </span>
                    </>
                  )}
                </div>

                {/* Model */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>
                    {translation("Assistants.details.model")}
                  </span>
                  <div className={styles.specTrack} />
                  {isEditing ? (
                    <select
                      className={styles.select}
                      value={read("model", "gpt-5.6-luna")}
                      onChange={(e) => handleChange("model", e.target.value)}
                    >
                      <option value="gpt-5.6-luna">Económico</option>

                      <option value="gpt-5.6-terra">Equilibrado</option>

                      <option value="gpt-5.6-sol">Avançado</option>
                    </select>
                  ) : (
                    <span className={styles.specValueBold}>
                      {selected.model}
                    </span>
                  )}
                </div>
              </div>

              {/* Meta + Actions */}
              <div className={styles.metaBar}>
                <div className={styles.metaGrid}>
                  <div>
                    <span className={styles.metaLabel}>ID</span>
                    <span>{selected.open_ai_id}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>
                      {translation("Assistants.details.createdAt")}
                    </span>
                    <span>
                      {new Date(selected.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className={styles.actionsRow}>
                  {isEditing ? (
                    <>
                      <button
                        className={styles.ctaPrimary}
                        disabled={isSaving}
                        onClick={handleSave}
                      >
                        {isSaving
                          ? translation("Assistants.details.saving")
                          : translation("Assistants.details.save")}
                      </button>
                      <button
                        className={styles.ghostBtn}
                        onClick={() => {
                          setIsEditing(false);
                          setDraft(null);
                        }}
                      >
                        {translation("Common.cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.ghostBtn}
                        onClick={() => {
                          setDraft(selected ? { ...selected } : null);
                          setIsEditing(true);
                        }}
                      >
                        {translation("Assistants.details.edit")}
                      </button>
                      <button
                        className={styles.dangerBtn}
                        onClick={deleteAssistant}
                      >
                        {translation("Assistants.details.delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Vector store (still paper card) */}
            <section className={`${styles.card} ${styles.paperCard}`}>
              {!selected.vectorStoreId ? (
                <>
                  <h3 className={styles.cardSubtitle}>
                    {translation("Assistants.vector.create")}
                  </h3>
                  <label className={styles.label}>
                    {translation("Assistants.vector.collectionName")}
                  </label>
                  <input
                    className={styles.input}
                    value={vsName}
                    onChange={(e) => setVsName(e.target.value)}
                    placeholder={`${translation(
                      "Assistants.vector.collectionNamePlaceholder",
                    )} ${selected.name}`}
                  />
                  <label className={styles.label}>
                    {translation("Assistants.vector.chooseFiles")}
                  </label>
                  <input
                    className={styles.input}
                    type="file"
                    multiple
                    onChange={(e) =>
                      setVsFiles(Array.from(e.target.files || []))
                    }
                  />
                  <div className={styles.rowEnd}>
                    <button
                      className={styles.ctaPrimary}
                      onClick={handleAddVectorStore}
                      disabled={!vsName.trim() || vsFiles.length === 0}
                    >
                      {translation("Assistants.vector.createAndAttach")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.vectorHeader}>
                    <h3 className={styles.cardSubtitle}>
                      {translation("Assistants.vector.docCollection")}
                    </h3>
                    {!isEditingVectorStore && (
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={beginVectorStoreEdit}
                        disabled={!vectorStore}
                        title={translation("Assistants.vector.editTitle")}
                      >
                        {translation("Assistants.vector.edit")}
                      </button>
                    )}
                  </div>

                  {isEditingVectorStore ? (
                    <div className={styles.vectorEditor}>
                      <label
                        className={styles.label}
                        htmlFor="vector-store-name"
                      >
                        {translation("Assistants.vector.collectionName")}
                      </label>
                      <input
                        id="vector-store-name"
                        className={styles.input}
                        value={vectorStoreDraftName}
                        onChange={(e) => setVectorStoreDraftName(e.target.value)}
                        placeholder={translation(
                          "Assistants.vector.storeNamePlaceholder",
                        )}
                      />

                      <p className={styles.helperText}>
                        {translation("Assistants.vector.replaceHelp")}
                      </p>

                      <div>
                        <span className={styles.metaLabel}>
                          {translation("Assistants.vector.filenames")}
                        </span>
                        {vectorStore?.files?.length ? (
                          <ul className={styles.vectorFileList}>
                            {vectorStore.files.map((file) => {
                              const isMarkedForRemoval =
                                removedVectorFileIds.includes(Number(file.id));

                              return (
                                <li
                                  key={file.id}
                                  className={`${styles.vectorFileRow} ${
                                    isMarkedForRemoval
                                      ? styles.vectorFileRemoved
                                      : ""
                                  }`}
                                >
                                  <span>{file.name}</span>
                                  <button
                                    type="button"
                                    className={styles.fileActionBtn}
                                    onClick={() => toggleVectorFileRemoval(file.id)}
                                  >
                                    {translation(
                                      isMarkedForRemoval
                                        ? "Assistants.vector.keep"
                                        : "Assistants.vector.remove",
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className={styles.helperText}>
                            {translation("Assistants.vector.noFiles")}
                          </p>
                        )}
                      </div>

                      <label
                        className={styles.label}
                        htmlFor="vector-store-edit-files"
                      >
                        {translation("Assistants.vector.addFiles")}
                      </label>
                      <input
                        id="vector-store-edit-files"
                        className={styles.input}
                        type="file"
                        multiple
                        onChange={(e) =>
                          setVectorStoreEditFiles(
                            Array.from(e.target.files || []),
                          )
                        }
                      />

                      {vectorStoreEditFiles.length > 0 && (
                        <div>
                          <span className={styles.metaLabel}>
                            {translation("Assistants.vector.newFiles")}
                          </span>
                          <ul className={styles.vectorFileList}>
                            {vectorStoreEditFiles.map((file) => (
                              <li
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                className={styles.vectorFileRow}
                              >
                                <span>{file.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className={styles.rowEnd}>
                        <button
                          type="button"
                          className={styles.ctaPrimary}
                          onClick={handleUpdateVectorStore}
                          disabled={
                            isSavingVectorStore || !vectorStoreDraftName.trim()
                          }
                        >
                          {isSavingVectorStore
                            ? translation("Assistants.vector.saving")
                            : translation("Assistants.vector.save")}
                        </button>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={cancelVectorStoreEdit}
                          disabled={isSavingVectorStore}
                        >
                          {translation("Common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.metaGrid}>
                        {vectorStore && (
                          <>
                            <div>
                              <span className={styles.metaLabel}>
                                {translation("Assistants.vector.collectionTitle")}
                              </span>
                              <span>{vectorStore.storeName}</span>
                            </div>
                            <div>
                              <span className={styles.metaLabel}>
                                {translation("Assistants.vector.quantity")}
                              </span>
                              <span>{vectorStore.files?.length || 0}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {vectorStore?.files?.length ? (
                        <div className={styles.vectorFilesReadOnly}>
                          <span className={styles.metaLabel}>
                            {translation("Assistants.vector.filenames")}
                          </span>
                          <ul className={styles.vectorFileList}>
                            {vectorStore.files.map((file) => (
                              <li key={file.id} className={styles.vectorFileRow}>
                                <span>{file.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className={styles.rowEnd}>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={deleteVectorStore}
                        >
                          {translation("Common.delete")}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          <div className={styles.placeholderCard}>
            <p>{translation("Assistants.placeholder")}</p>
          </div>
        )}
      </section>

      {/* RIGHT: live chat */}
      <section className={styles.chatCol}>
        {selected && !authLoading && !orgLoading && (
          <ChatSandbox assistant={selected} />
        )}
      </section>

      <CreateAssistantModal
        orgId={orgId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleAssistantCreated}
        scoped
      />
    </div>
  );
}
