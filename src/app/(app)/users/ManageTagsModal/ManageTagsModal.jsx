"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./manageTagsModal.module.css";

export default function ManageTagsModal({ isOpen, onClose, orgId }) {
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [nameInput, setNameInput] = useState("");

  // ---------- API helpers ----------

  async function fetchTags() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tags?orgId=${orgId}`);
      if (!res.ok) {
        console.error("GET /api/tags failed:", await res.text());
        setTags([]);
        setSelectedId(null);
        setNameInput("");
        return;
      }

      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setTags(arr);
      if (arr.length) {
        setSelectedId(arr[0].id);
        setNameInput(arr[0].name || "");
      } else {
        setSelectedId(null);
        setNameInput("");
      }
    } catch (e) {
      console.error(e);
      setTags([]);
      setSelectedId(null);
      setNameInput("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    fetchTags(orgId);
  }, [isOpen, orgId]);

  const selectedTag = useMemo(() => {
    return Array.isArray(tags)
      ? tags.find((t) => t.id === selectedId) || null
      : null;
  }, [tags, selectedId]);

  async function createTag() {
    const base = nameInput.trim() || `Grupo ${tags.length + 1}`;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, name: base }),
    });
    if (!res.ok) return;
    const t = await res.json();
    setTags((prev) => [t, ...prev]);
    setSelectedId(t.id);
    setNameInput(t.name);
  }

  async function saveRename() {
    if (!selectedTag) return;
    const next = nameInput.trim();
    if (!next || next === selectedTag.name) return;
    await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedTag.id, name: next }),
    });
    setTags((prev) =>
      prev.map((t) => (t.id === selectedTag.id ? { ...t, name: next } : t))
    );
  }

  async function removeTag(id) {
    await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
    setTags((prev) => prev.filter((t) => t.id !== id));
    if (id === selectedId) {
      const next = tags.find((t) => t.id !== id);
      setSelectedId(next?.id ?? null);
      setNameInput(next?.name ?? "");
    }
  }

  // ---------- UI ----------
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={styles.header}>
          <h3>Gerir Tags</h3>
        </div>

        <div className={styles.body}>
          {/* LEFT: chips */}
          <div className={styles.leftCol}>
            {loading ? (
              <div className={styles.muted}>A carregar…</div>
            ) : (
              <div className={styles.chipsArea}>
                {Array.isArray(tags) && tags.length ? (
                  tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.chip} ${
                        t.id === selectedId ? styles.chipActive : ""
                      }`}
                      onClick={() => {
                        setSelectedId(t.id);
                        setNameInput(t.name || "");
                      }}
                    >
                      <span className={styles.chipLabel}>{t.name}</span>
                      <span
                        className={styles.chipClose}
                        role="button"
                        aria-label={`Remover ${t.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTag(t.id);
                        }}
                      >
                        ×
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={styles.muted}>Sem tags.</div>
                )}
              </div>
            )}
          </div>

          {/* DIVIDER */}
          <div className={styles.divider} />

          {/* RIGHT: editor */}
          <div className={styles.rightCol}>
            <label className={styles.label} htmlFor="tag-name">
              Nome:
            </label>
            <input
              id="tag-name"
              className={styles.nameInput}
              placeholder="Grupo 1"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveRename}
                disabled={!selectedTag}
              >
                Guardar Alterações
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                title="Nova tag"
                onClick={createTag}
              >
                Adicionar
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.closeX}
          aria-label="Fechar"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
