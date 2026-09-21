// src/app/[locale]/(app)/users/ManageTagsModal/ManageTagsModal.jsx
"use client";
import { useEffect, useState } from "react";
import styles from "./manageTagsModal.module.css";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";

/* A partir de quantas tags aparece a pesquisa. */
const SEARCH_THRESHOLD = 8;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/*
 * Primeiro "Grupo N" que ainda não existe. A base de dados compara pelo slug
 * (minúsculas, espaços como hífen), por isso a comparação segue a mesma regra.
 */
function nextGroupName(tags) {
  const slug = (value) =>
    String(value ?? "")
      .toLowerCase()
      .trim()
      .replace(/s+/g, "-");
  const taken = new Set(tags.map((t) => slug(t.name)));

  let n = tags.length + 1;
  while (taken.has(slug(`Grupo ${n}`))) n += 1;
  return `Grupo ${n}`;
}

export default function ManageTagsModal({
  isOpen,
  onClose,
  orgId,
  tags = [],
  setTags,
}) {
  const translation = useTranslations();
  const confirm = useConfirm();

  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  // mount/unmount animation
  const [render, setRender] = useState(isOpen);
  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  useEffect(() => {
    if (!render) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Esc a meio de mudar um nome só cancela a edição.
      if (editingId != null) setEditingId(null);
      else onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose, editingId]);

  const stateClass = isOpen ? styles.open : styles.closing;
  const list = Array.isArray(tags) ? tags : [];

  /* 409 é nome repetido; o resto é uma falha que o utilizador não resolve. */
  function errorFor(res) {
    return translation(
      res.status === 409
        ? "ManageTagsModal.nameTaken"
        : "ManageTagsModal.saveFailed",
    );
  }

  async function createTag() {
    const name = newName.trim() || nextGroupName(list);
    setError("");
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, name }),
    });
    if (!res.ok) {
      setError(errorFor(res));
      return;
    }
    const t = await res.json();
    setTags?.((prev) => [t, ...(prev || [])]);
    setNewName("");
  }

  function startRename(tag) {
    setEditingId(tag.id);
    setEditName(tag.name || "");
  }

  async function saveRename(tag) {
    const next = editName.trim();
    setEditingId(null);
    if (!next || next === tag.name) return;
    setError("");
    const res = await fetch("/api/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, name: next }),
    });
    if (!res.ok) {
      setError(errorFor(res));
      return;
    }
    setTags?.((prev) =>
      (prev || []).map((t) => (t.id === tag.id ? { ...t, name: next } : t)),
    );
  }

  async function removeTag(tag) {
    const ok = await confirm({
      title: translation("ManageTagsModal.confirmDeleteTitle", {
        name: tag.name,
      }),
      message: translation("ManageTagsModal.confirmDeleteMessage"),
      confirmText: translation("Common.delete"),
      cancelText: translation("Common.cancel"),
      tone: "danger",
    });
    if (!ok) return;

    await fetch(`/api/tags?id=${tag.id}`, { method: "DELETE" });
    setTags?.((prev) => (prev || []).filter((t) => t.id !== tag.id));
  }

  if (!render) return null;

  const wanted = normalize(query.trim());
  const visible = wanted
    ? list.filter((t) => normalize(t.name).includes(wanted))
    : list;

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
          <form
            className={styles.createRow}
            onSubmit={(e) => {
              e.preventDefault();
              createTag();
            }}
          >
            <label className={styles.label} htmlFor="new-tag-name">
              {translation("ManageTagsModal.newLabel")}
            </label>
            <div className={styles.createControls}>
              <input
                id="new-tag-name"
                className={styles.input}
                placeholder={translation("ManageTagsModal.placeholder")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit" className={styles.btnPrimary}>
                {translation("ManageTagsModal.add")}
              </button>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>

          <div className={styles.field}>
            <div className={styles.listHead}>
              <span className={styles.label}>
                {translation("ManageTagsModal.listLabel")}
              </span>
              {list.length > 0 && (
                <span className={styles.count}>{list.length}</span>
              )}
            </div>

            <div className={styles.box}>
              {list.length > SEARCH_THRESHOLD && (
                <input
                  type="search"
                  className={styles.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={translation("ManageTagsModal.search")}
                  aria-label={translation("ManageTagsModal.search")}
                />
              )}

              <ul className={styles.list}>
                {visible.map((tag) =>
                  editingId === tag.id ? (
                    <li key={tag.id} className={styles.row}>
                      <form
                        className={styles.editForm}
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveRename(tag);
                        }}
                      >
                        <input
                          autoFocus
                          className={styles.editInput}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          aria-label={translation("ManageTagsModal.name")}
                        />
                        <button type="submit" className={styles.rowAction}>
                          {translation("ManageTagsModal.save")}
                        </button>
                        <button
                          type="button"
                          className={styles.rowAction}
                          onClick={() => setEditingId(null)}
                        >
                          {translation("ManageTagsModal.cancel")}
                        </button>
                      </form>
                    </li>
                  ) : (
                    <li key={tag.id} className={styles.row}>
                      <span className={styles.name}>{tag.name}</span>
                      <button
                        type="button"
                        className={styles.rowAction}
                        onClick={() => startRename(tag)}
                      >
                        {translation("ManageTagsModal.rename")}
                      </button>
                      <button
                        type="button"
                        className={`${styles.rowAction} ${styles.rowActionDanger}`}
                        aria-label={translation("ManageTagsModal.removeLabel", {
                          name: tag.name,
                        })}
                        onClick={() => removeTag(tag)}
                      >
                        {translation("ManageTagsModal.delete")}
                      </button>
                    </li>
                  ),
                )}

                {!visible.length && (
                  <li className={styles.empty}>
                    {list.length
                      ? translation("ManageTagsModal.noResults")
                      : translation("ManageTagsModal.none")}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            {translation("ManageTagsModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
