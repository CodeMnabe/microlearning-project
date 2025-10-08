"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "./assistants.module.css";
import CreateAssistantModal from "./CreateAssistantModal";
import ChatSandbox from "./Chatbox/Chatbox.jsx";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

const ORG_ID = 1;

export default function AssistantsHub() {
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

  // fetch all
  useEffect(() => {
    (async () => {
      startLoading();
      try {
        const res = await fetch(`/api/assistants?orgId=${ORG_ID}`);
        const data = await res.json();
        setAssistants(data || []);
        if (data?.length && !selectedId) setSelectedId(data[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        stopLoading();
      }
    })();
  }, [startLoading, stopLoading, selectedId]);

  // fetch one (details + vector store) whenever selectedId changes
  const fetchOne = useCallback(
    async (id) => {
      if (!id) return;
      startLoading();
      try {
        const res = await fetch(`/api/assistants/${id}`);
        const data = await res.json();
        setSelected(data);

        if (data?.vectorStoreId) {
          const r = await fetch(
            `/api/assistants/${id}/vector-store/${data.vectorStoreId}`
          );
          const store = await r.json();
          setVectorStore(store);
        } else {
          setVectorStore(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  useEffect(() => {
    fetchOne(selectedId);
  }, [selectedId, fetchOne]);

  // create modal handlers
  function openCreate() {
    setIsModalOpen(true);
  }
  async function handleAssistantCreated() {
    const updated = await fetch(`/api/assistants?orgId=${ORG_ID}`).then((r) =>
      r.json()
    );
    setAssistants(updated);
    const newest = updated[updated.length - 1];
    setSelectedId(newest?.id ?? null);
    setIsModalOpen(false);
  }

  function handleChange(field, value) {
    setSelected((prev) => ({ ...prev, [field]: value }));
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
        const { error } = await res.json();
        alert("Erro ao guardar: " + error);
        return;
      }
      setIsEditing(false);
      // refresh to keep DB truth
      await fetchOne(selected.id);
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
        const { error } = await res.json();
        alert("Erro: " + error);
        return;
      }
      // prune list
      const remaining = assistants.filter((a) => a.id !== selected.id);
      setAssistants(remaining);
      setSelected(null);
      setSelectedId(remaining[0]?.id ?? null);
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
      const data = await res.json();
      if (!res.ok) {
        alert("Erro: " + (data?.error || "Falha ao criar a store"));
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
    if (!selected?.vectorStoreId) return;
    if (!confirm("Eliminar vector store e ficheiros?")) return;
    startLoading();
    try {
      const res = await fetch(
        `/api/assistants/${selected.id}/vector-store/${selected.vectorStoreId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const { message } = await res.json();
        alert("Erro: " + (message || "Falha a eliminar a store"));
        return;
      }
      await fetchOne(selected.id);
    } finally {
      stopLoading();
    }
  }

  return (
    <div className={styles.hub /* <- relative; modal is scoped here */}>
      {/* LEFT: list + add */}
      <aside className={styles.listCol}>
        <div className={styles.listHeader}>
          <span>Os meus Assistentes</span>
          <button className={styles.addBtn} onClick={openCreate}>
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
              {/* <span className={styles.listItemDot} /> */}
              <span className={styles.listItemName}>{a.name}</span>
            </button>
          ))}
          {!assistants.length && (
            <div className={styles.emptyState}>
              <p>Sem assistants ainda.</p>
              <button className={styles.ctaPrimary} onClick={openCreate}>
                Criar Assistant
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* CENTER: big card with details + vector store */}
      <main className={styles.mainCol}>
        {selected ? (
          <>
            <section className={`${styles.card} ${styles.primaryCard}`}>
              <div className={styles.cardTitleRow}>
                {isEditing ? (
                  <input
                    className={styles.inputTitle}
                    value={selected.name}
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
                    value={selected.description ?? ""}
                    maxLength={80}
                    onChange={(e) =>
                      handleChange("description", e.target.value)
                    }
                    placeholder="Descrição curta"
                  />
                  <textarea
                    className={styles.instructionsInput}
                    value={selected.instructions ?? ""}
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
                {/* Top Palavras */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>Criatividade</span>
                  {isEditing ? (
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderValue}>
                        {(selected.top_p ?? 0).toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selected.top_p ?? 0}
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
                          style={{ width: `${(selected.top_p ?? 0) * 100}%` }}
                        />
                      </div>
                      <span className={styles.specValue}>
                        {(selected.top_p ?? 0).toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                {/* Objetividade */}
                <div className={styles.specRowGrid}>
                  <span className={styles.specLabel}>Variedade</span>
                  {isEditing ? (
                    <div className={styles.sliderRow}>
                      <span className={styles.sliderValue}>
                        {(selected.temperature ?? 0).toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={selected.temperature ?? 0}
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
                              Math.min((selected.temperature ?? 0) / 2, 1) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className={styles.specValue}>
                        {(selected.temperature ?? 0).toFixed(0)}
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
                      value={selected.model}
                      onChange={(e) => handleChange("model", e.target.value)}
                    >
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                      {/* <option value="gpt-4o">gpt-4o</option> */}
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
                    onChange={(e) => setVsFiles(Array.from(e.target.files))}
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
                          <span>{vectorStore.files?.length ?? 0}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {vectorStore?.files?.length ? (
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
        {selected && <ChatSandbox assistant={selected} />}
      </section>

      {/* Modal is SCOPED to this hub container */}
      <CreateAssistantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleAssistantCreated}
        scoped
      />
    </div>
  );
}
