// app/[locale]/(app)/users/EditUserModal.jsx
"use client";
import { useEffect, useState } from "react";
import styles from "./users.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import { useTranslations } from "next-intl";

export default function EditUserModal({
  open,
  onClose,
  user,
  orgId,
  assistants = [],
  onDelete,
  onSaved,
}) {
  const translation = useTranslations();
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [assistantId, setAssistantId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // tags
  const [allTags, setAllTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Keep mounted while the closing animation runs
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) setRender(true);
  }, [open]);

  // Prefill fields when opening
  useEffect(() => {
    if (!open || !user) return;
    setName(user.name || "");
    setPhone(user.phone || user.phone_number || "");
    setEmail(user.email || "");
    setAssistantId(user.assistantId ?? null);
    setSelectedTagIds(user.tagIds || user.tag_ids || []);
  }, [open, user]);

  // Load tags when opened
  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      try {
        const res = await fetch(`/api/tags?orgId=${orgId}`);
        const data = await res.json();
        setAllTags(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setAllTags([]);
      }
    })();
  }, [open, orgId]);

  // ESC to close
  useEffect(() => {
    if (!render) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose]);

  if (!render || !user) return null;

  function toggleTag(id) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name,
          phoneNumber: phone,
          email,
          assistantId,
          tagIds: selectedTagIds,
        }),
      });
      if (!res.ok) {
        console.error(await res.text());
        return;
      }
      const updated = await res.json();
      onSaved?.(updated);
      onClose?.();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = await confirm({
      title: translation("Users.confirmDeleteTitle", { name: user.name }),
      message: translation("Users.confirmDeleteMessage"),
      confirmText: translation("Common.delete"),
      cancelText: translation("Common.cancel"),
      tone: "danger",
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      await onDelete(user.id);
      onSaved?.();
      onClose?.();
    } finally {
      setIsDeleting(false);
    }
  }

  const stateClass = open ? styles.open : styles.closing;

  return (
    <div
      className={`${styles.modalOverlay} ${stateClass}`}
      role="dialog"
      aria-modal="true"
      onAnimationEnd={(e) => {
        if (!open && e.target === e.currentTarget) setRender(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`${styles.modalContent} ${stateClass}`}>
        <h3 className={styles.modalTitle}>
          {translation("EditUserModal.title")}
        </h3>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>{translation("EditUserModal.name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={translation("EditUserModal.name")}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("EditUserModal.phone")}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={translation("EditUserModal.phone")}
            />
          </div>

          <div className={styles.formGroup}>
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@exemplo.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("EditUserModal.assistant")}</label>
            <PillSelect
              options={assistants.map((a) => ({ value: a.id, label: a.name }))}
              value={assistantId ?? ""}
              onChange={(val) => setAssistantId(val)}
              placeholder={translation("EditUserModal.chooseAssistant")}
              fullWidth
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("EditUserModal.tags")}</label>
            <div className={styles.tagsWrap}>
              {allTags.map((t) => {
                const checked = selectedTagIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`${styles.chip} ${styles.chipCheck} ${
                      checked ? styles.chipChecked : ""
                    }`}
                    title={
                      checked
                        ? translation("EditUserModal.remove")
                        : translation("EditUserModal.add")
                    }
                  >
                    <input
                      type="checkbox"
                      className={styles.visuallyHidden}
                      checked={checked}
                      onChange={() => toggleTag(t.id)}
                    />
                    <span className={styles.checkboxSquare} aria-hidden="true">
                      <svg viewBox="0 0 24 24" className={styles.checkIcon}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <span className={styles.chipText}>{t.name}</span>
                  </label>
                );
              })}
              {!allTags.length && (
                <div style={{ color: "var(--ui-muted)" }}>
                  {translation("EditUserModal.noTags")}
                </div>
              )}
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              style={{
                background: "#fff5f5",
                color: "#b42318",
                border: "1px solid #ffd0d0",
              }}
            >
              {isDeleting
                ? translation("EditUserModal.deleting")
                : translation("EditUserModal.delete")}
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button type="button" onClick={onClose}>
                {translation("EditUserModal.cancel")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving || isDeleting}
              >
                {isSaving
                  ? translation("EditUserModal.saving")
                  : translation("EditUserModal.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
