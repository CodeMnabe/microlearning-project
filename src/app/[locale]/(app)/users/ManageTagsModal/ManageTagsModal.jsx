// src/app/[locale]/(app)/users/ManageTagsModal/ManageTagsModal.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./manageTagsModal.module.css";
import { useTranslations } from "next-intl";

export default function ManageTagsModal({
  isOpen,
  onClose,
  orgId,
  tags = [],
  setTags,
}) {
  const translation = useTranslations();
  const [selectedId, setSelectedId] = useState(null);
  const [nameInput, setNameInput] = useState("");

  // mount/unmount animation
  const [render, setRender] = useState(isOpen);
  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  useEffect(() => {
    if (!render) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose]);

  const stateClass = isOpen ? styles.open : styles.closing;

  // When modal opens or tags change, pick a sensible selection
  useEffect(() => {
    if (!isOpen) return;
    const first = tags?.[0];
    if (first && !tags.find((t) => t.id === selectedId)) {
      setSelectedId(first.id);
      setNameInput(first.name || "");
    }
    if (!tags?.length) {
      setSelectedId(null);
      setNameInput("");
    }
  }, [isOpen, tags, selectedId]);

  const selectedTag = useMemo(
    () =>
      Array.isArray(tags)
        ? tags.find((t) => t.id === selectedId) || null
        : null,
    [tags, selectedId]
  );

  async function createTag() {
    const base = (nameInput || "").trim() || `Grupo ${tags.length + 1}`;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, name: base }),
    });
    if (!res.ok) return;
    const t = await res.json();
    setTags?.((prev) => [t, ...(prev || [])]);
    setSelectedId(t.id);
    setNameInput(t.name || "");
  }

  async function saveRename() {
    if (!selectedTag) return;
    const next = (nameInput || "").trim();
    if (!next || next === selectedTag.name) return;
    await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedTag.id, name: next }),
    });
    setTags?.((prev) =>
      (prev || []).map((t) =>
        t.id === selectedTag.id ? { ...t, name: next } : t
      )
    );
  }

  async function removeTag(id) {
    await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
    setTags?.((prev) => (prev || []).filter((t) => t.id !== id));
    if (id === selectedId) {
      const next = (tags || []).find((t) => t.id !== id);
      setSelectedId(next?.id ?? null);
      setNameInput(next?.name ?? "");
    }
  }

  if (!render) return null;

  return (
    <div
      className={`${styles.overlay} ${stateClass}`}
      role="dialog"
      aria-modal="true"
      onAnimationEnd={(e) => {
        if (!isOpen && e.target === e.currentTarget) setRender(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`${styles.card} ${stateClass}`}>
        <div className={styles.header}>
          <h3>{translation("ManageTagsModal.title")}</h3>
        </div>

        <div className={styles.body}>
          {/* LEFT: chips */}
          <div className={styles.leftCol}>
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
                      aria-label={translation("ManageTagsModal.removeLabel", {
                        name: t.name,
                      })}
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
                <div className={styles.muted}>
                  {translation("ManageTagsModal.none")}
                </div>
              )}
            </div>
          </div>

          <div className={styles.divider} />

          {/* RIGHT: editor */}
          <div className={styles.rightCol}>
            <label className={styles.label} htmlFor="tag-name">
              {translation("ManageTagsModal.name")}
            </label>
            <input
              id="tag-name"
              className={styles.nameInput}
              placeholder={translation("ManageTagsModal.placeholder")}
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
                {translation("ManageTagsModal.save")}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={createTag}
              >
                {translation("ManageTagsModal.add")}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={onClose}
              >
                {translation("ManageTagsModal.cancel")}
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
