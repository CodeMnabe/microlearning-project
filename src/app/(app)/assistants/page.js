"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./assistants.module.css";
import CreateAssistantModal from "./CreateAssistantModal";
import ChatSandbox from "./Chatbox/Chatbox.jsx";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";

export default function AssistantsHub() {
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const orgId = org?.id || null;

  const { startLoading, stopLoading } = useGlobalLoader();
  const [assistants, setAssistants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [vectorStore, setVectorStore] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // vector store form
  const [vsName, setVsName] = useState("");
  const [vsFiles, setVsFiles] = useState([]);

  // 1) fetch assistants when auth/org are ready
  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;

    let alive = true;
    (async () => {
      startLoading();
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
  }, [authLoading, orgLoading, orgId, startLoading, selectedId, stopLoading]); // ← no selectedId here (prevents refetch loops)

  // 2) fetch details of current assistant
  const fetchOne = useCallback(
    async (id) => {
      if (!id) return;
      let alive = true;
      startLoading();
      // clear previous selection to avoid flicker
      setSelected(null);
      setVectorStore(null);

      try {
        const res = await fetch(`/api/assistants/${id}`);
        const data = await res.json();
        if (!alive) return;
        setSelected(data);

        if (data && data.vectorStoreId) {
          const r = await fetch(
            `/api/assistants/${id}/vector-store/${data.vectorStoreId}`
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
    [startLoading, stopLoading]
  );

  useEffect(() => {
    if (selectedId) fetchOne(selectedId);
  }, [selectedId, fetchOne]);

  // modal open
  function openCreate() {
    if (!orgId) return; // guard
    setIsModalOpen(true);
  }

  // after creating a new assistant, refresh list and select newest
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

  function handleChange(field, value) {
    setSelected((prev) => ({ ...(prev || {}), [field]: value }));
  }

  async function handleSave() {
    if (!selected) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assistants/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          open_ai_id: selected.open_ai_id,
          name: selected.name,
          description: selected.description,
          instructions: selected.instructions,
          model: selected.model,
          temperature: selected.temperature,
          top_p: selected.top_p,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert("Erro ao guardar: " + (payload.error || res.statusText));
        return;
      }
      setIsEditing(false);
      await fetchOne(selected.id); // refresh with DB truth
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAssistant() {
    if (!selected) return;
    if (!confirm("Eliminar este assistant?")) return;
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

  async function handleAddVectorStore() {
    if (!selected) return;
    if (!vsName.trim() || vsFiles.length === 0) return;

    startLoading();
    try {
      const fd = new FormData();
      fd.append("storeName", vsName);
      vsFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`/api/assistants/${selected.id}/vector-store`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Erro: " + (data.error || "Falha ao criar a store"));
        return;
      }
      setVsName("");
      setVsFiles([]);
      await fetchOne(selected.id);
    } finally {
      stopLoading();
    }
  }

  async function deleteVectorStore() {
    if (!selected || !selected.vectorStoreId) return;
    if (!confirm("Eliminar vector store e ficheiros?")) return;
    startLoading();
    try {
      const res = await fetch(
        `/api/assistants/${selected.id}/vector-store/${selected.vectorStoreId}`,
        { method: "DELETE" }
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

  return (
    <div className={styles.hub}>
      {/* LEFT: list + add */}
      <aside className={styles.listCol}>
        <div className={styles.listHeader}>
          <span>Os meus Assistentes</span>
          <button
            className={styles.addBtn}
            onClick={openCreate}
            disabled={!orgId}
            title={!orgId ? "A carregar organização…" : "Criar Assistant"}
          >
            +
          </button>
        </div>

        <div className={styles.list}>
          {assistants.map((a) => (
            <button
              key={a.id}
              className={`${styles.listItem} ${
                a.id === selectedId ? styles.listItemActive : ""
              }`}
              onClick={() => setSelectedId(a.id)}
            >
              <span className={styles.listItemName}>{a.name}</span>
            </button>
          ))}

          {!assistants.length && (
            <div className={styles.emptyState}>
              <p>Sem assistants ainda.</p>
              <button
                className={styles.ctaPrimary}
                onClick={openCreate}
                disabled={!orgId}
              >
                Criar Assistant
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* CENTER: details + vector store */}
      <main className={styles.mainCol}>
        {selected ? (
          <>
            <section className={`${styles.card} ${styles.primaryCard}`}>
              <div className={styles.cardTitleRow}>
                {isEditing ? (
                  <input
                    className={styles.inputTitle}
                    value={selected.name || ""}
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
                    value={selected.description || ""}
                    maxLength={80}
                    onChange={(e) =>
                      handleChange("description", e.target.value)
                    }
                    placeholder="Descrição curta"
                  />
                  <textarea
                    className={styles.instructionsInput}
                    value={selected.instructions || ""}
                    onChange={(e) =>
                      handleChange("instructions", e.target.value)
                    }
                    placeholder="Instruções do assistente"
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

              <div className={styles.specBadge}>Especificidades:</div>

              <div className={styles.specs}>
                {/* Criatividade (top_p) */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>Criatividade</span>
                  {isEditing ? (
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderValue}>
                        {(selected.top_p || 0).toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selected.top_p || 0}
                        onChange={(e) =>
                          handleChange("top_p", parseFloat(e.target.value))
                        }
                      />
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

                {/* Variedade (temperature) */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>Variedade</span>
                  {isEditing ? (
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderValue}>
                        {(selected.temperature || 0).toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={selected.temperature || 0}
                        onChange={(e) =>
                          handleChange(
                            "temperature",
                            parseFloat(e.target.value)
                          )
                        }
                      />
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

                {/* Modelo */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>Modelo</span>
                  <div className={styles.specTrack} />
                  {isEditing ? (
                    <select
                      className={styles.select}
                      value={selected.model || "gpt-3.5-turbo"}
                      onChange={(e) => handleChange("model", e.target.value)}
                    >
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  ) : (
                    <span className={styles.specValueBold}>
                      {selected.model}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.metaGrid}>
                <div>
                  <span className={styles.metaLabel}>ID</span>
                  <span>{selected.open_ai_id}</span>
                </div>
                <div>
                  <span className={styles.metaLabel}>Criado em</span>
                  <span>{new Date(selected.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.rowEnd}>
                {isEditing ? (
                  <>
                    <button
                      className={styles.ctaPrimary}
                      disabled={isSaving}
                      onClick={handleSave}
                    >
                      {isSaving ? "A guardar..." : "Guardar"}
                    </button>
                    <button
                      className={styles.ghostBtn}
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={styles.ghostBtn}
                      onClick={() => setIsEditing(true)}
                    >
                      Editar
                    </button>
                    <button
                      className={styles.dangerBtn}
                      onClick={deleteAssistant}
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Vector store card */}
            <section className={`${styles.card} ${styles.paperCard}`}>
              {!selected.vectorStoreId ? (
                <>
                  <h3 className={styles.cardSubtitle}>
                    Criar coleção de ficheiros
                  </h3>
                  <label className={styles.label}>Nome da coleção</label>
                  <input
                    className={styles.input}
                    value={vsName}
                    onChange={(e) => setVsName(e.target.value)}
                    placeholder={`Ex.: Coleção para ${selected.name}`}
                  />
                  <label className={styles.label}>
                    Escolher Ficheiros (pode escolher vários):
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
                      Criar e Associar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className={styles.cardSubtitle}>Coleção de Documentos</h3>
                  <div className={styles.metaGrid}>
                    {vectorStore && (
                      <>
                        <div>
                          <span className={styles.metaLabel}>
                            Nome da Coleção
                          </span>
                          <span>{vectorStore.storeName}</span>
                        </div>
                        <div>
                          <span className={styles.metaLabel}>Quantidade</span>
                          <span>{vectorStore.files?.length || 0}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {vectorStore &&
                  vectorStore.files &&
                  vectorStore.files.length ? (
                    <div style={{ marginTop: 8 }}>
                      <span className={styles.metaLabel}>
                        Nome dos Ficheiros
                      </span>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                        {vectorStore.files.map((f) => (
                          <li key={f.id}>{f.name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className={styles.rowEnd}>
                    <button
                      className={styles.dangerBtn}
                      onClick={deleteVectorStore}
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        ) : (
          <div className={styles.placeholderCard}>
            <p>Seleciona um assistant na coluna da esquerda.</p>
          </div>
        )}
      </main>

      {/* RIGHT: live chat */}
      <section className={styles.chatCol}>
        {selected && !authLoading && !orgLoading && (
          <ChatSandbox assistant={selected} />
        )}
      </section>

      {/* Modal (scoped) */}
      <CreateAssistantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleAssistantCreated}
        scoped
      />
    </div>
  );
}
