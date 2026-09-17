// app/[locale]/(app)/users/EditUserModal.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./users.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import AssistantsField from "./AssistantsField";
import CheckList from "./CheckList/CheckList";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import { useTranslations } from "next-intl";
import phoneCountryCodes from "../../../../messages/phoneCountryCodes.json";

function stripPrefixFromPhone(full, code) {
  if (!full) return "";
  if (code && full.startsWith(code)) return full.slice(code.length);
  return full.replace(/^\+/, "");
}

const PHONE_CODE_OPTIONS = phoneCountryCodes.map((c) => ({
  value: c.code,
  label: `${c.code} (${c.iso2})`,
}));

export default function EditUserModal({
  open,
  onClose,
  user,
  orgId,
  assistants = [],
  onDelete,
  onSaved,
  defaultPhoneCode = "+351",
}) {
  const translation = useTranslations();
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [phoneCode, setPhoneCode] = useState(defaultPhoneCode);
  const [phoneNational, setPhoneNational] = useState("");
  const [email, setEmail] = useState("");
  const [assistantId, setAssistantId] = useState(null);
  const [assistantIds, setAssistantIds] = useState([]);
  const [teamsAadObjectId, setTeamsAadObjectId] = useState(null);
  const [teamsFromId, setTeamsFromId] = useState("");
  const [saving, setSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // accordion open/closed
  const [whatsAppOpen, setWhatsAppOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(false);

  // tags
  const [allTags, setAllTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Selecionados ao abrir: aparecem primeiro nas listas.
  const initialAssistantIds = useMemo(() => {
    const activeId = user?.assistantId ?? user?.assistant_id ?? null;
    return (
      user?.assistantIds ?? user?.assistant_ids ?? (activeId ? [activeId] : [])
    );
  }, [user]);

  const initialTagIds = useMemo(
    () => user?.tagIds || user?.tag_ids || [],
    [user],
  );

  // Keep mounted while the closing animation runs
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) setRender(true);
  }, [open]);

  // Prefill fields when opening
  useEffect(() => {
    if (!open || !user) return;

    setName(user.name || "");

    const code =
      user.phoneCountryCode ||
      user.phone_country_code ||
      defaultPhoneCode ||
      "";

    const full = user.phone || user.phone_number || "";

    setPhoneCode(code);
    setPhoneNational(
      user.phoneNational ||
        user.phone_national ||
        stripPrefixFromPhone(full, code),
    );

    setEmail(user.email || "");
    const activeId = user.assistantId ?? user.assistant_id ?? null;
    setAssistantId(activeId);
    setAssistantIds(
      user.assistantIds ?? user.assistant_ids ?? (activeId ? [activeId] : []),
    );

    setTeamsAadObjectId(
      user.teamsAadObjectId ?? user.teams_aad_object_id ?? null,
    );
    setTeamsFromId(user.teamsFromId ?? user.teams_from_id ?? "");
    setSelectedTagIds(user.tagIds || user.tag_ids || []);

    // accordion defaults
    setWhatsAppOpen(false);
    setTeamsOpen(false);
  }, [open, user, defaultPhoneCode]);

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
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    setIsSaving(true);
    try {
      const fullPhone =
        phoneCode && phoneNational
          ? `${phoneCode}${phoneNational.replace(/\D/g, "")}`
          : user.phone || user.phone_number || null;

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name,
          email,
          assistantId,
          assistantIds,
          tagIds: selectedTagIds,
          phoneCountryCode: phoneCode,
          phoneNational,
          phoneNumber: fullPhone,
          teamsAadObjectId,
          teamsFromId,
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
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`${styles.modalContent} ${styles.modalContentForm} ${stateClass}`}
      >
        <h3 className={styles.modalTitle}>
          {translation("EditUserModal.title")}
        </h3>

        <div className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>{translation("EditUserModal.name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={translation("EditUserModal.name")}
              />
            </div>

            {/* <div className={styles.formGroup}>
              <label>{translation("EditUserModal.phone")}</label>
              <div className={styles.phoneRow}>
                <PillSelect
                  options={PHONE_CODE_OPTIONS}
                  value={phoneCode}
                  onChange={(val) => setPhoneCode(val)}
                  className={styles.phoneCodeSelect}
                  portalToBody
                  menuWidth={135}
                />
                <input
                  type="text"
                  value={phoneNational}
                  onChange={(e) => setPhoneNational(e.target.value)}
                  placeholder="912 345 678"
                />
              </div>
            </div> */}

            <div className={styles.formGroup}>
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@exemplo.com"
              />
            </div>
          </div>

          <AssistantsField
            assistants={assistants}
            assistantIds={assistantIds}
            initialAssistantIds={initialAssistantIds}
            activeAssistantId={assistantId}
            onChange={(next) => {
              setAssistantIds(next.assistantIds);
              setAssistantId(next.activeAssistantId);
            }}
          />

          {/* ───── Teams section ───── */}
          {/* <div className={styles.sectionDivider}>
            <span className={styles.sectionDividerLabel}>
              Canais de Comunicação
            </span>
          </div>

          <div className={styles.formGroup}>
            <label>Teams Aad Object ID</label>
            <input
              value={teamsAadObjectId ?? ""}
              onChange={(e) => setTeamsAadObjectId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Teams From Id</label>
            <input
              value={teamsFromId ?? ""}
              onChange={(e) => setTeamsFromId(e.target.value)}
              placeholder="29:XXXXXXXXXXXX"
            />
          </div>

          <div className={styles.sectionDivider} /> */}
          {/* ───────────────────────── */}

          {/* ───── Canais de Comunicação (accordion) ───── */}
          <div className={styles.sectionDivider}>
            <span className={styles.sectionDividerLabel}>
              Canais de Comunicação
            </span>
          </div>

          <div className={styles.channelList}>
            {/* WhatsApp row */}
            <div className={styles.channelRow}>
              <button
                type="button"
                className={styles.channelMain}
                onClick={() => setWhatsAppOpen((v) => !v)}
              >
                <div className={styles.channelMainLeft}>
                  <span className={styles.channelLabel}>WhatsApp</span>
                </div>
                <div className={styles.channelMainRight}>
                  <span
                    className={`${styles.channelChevron} ${
                      whatsAppOpen ? styles.channelChevronOpen : ""
                    }`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </button>

              {whatsAppOpen && (
                <div className={styles.channelFields}>
                  <div className={styles.formGroup}>
                    <label>{translation("EditUserModal.phone")}</label>
                    <div className={styles.phoneRow}>
                      <PillSelect
                        options={PHONE_CODE_OPTIONS}
                        value={phoneCode}
                        onChange={(val) => setPhoneCode(val)}
                        className={styles.phoneCodeSelect}
                        portalToBody
                        menuWidth={135}
                      />
                      <input
                        type="text"
                        value={phoneNational}
                        onChange={(e) => setPhoneNational(e.target.value)}
                        placeholder="912 345 678"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Microsoft Teams row */}
            <div className={styles.channelRow}>
              <button
                type="button"
                className={styles.channelMain}
                onClick={() => setTeamsOpen((v) => !v)}
              >
                <div className={styles.channelMainLeft}>
                  <span className={styles.channelLabel}>Microsoft Teams</span>
                </div>
                <div className={styles.channelMainRight}>
                  <span
                    className={`${styles.channelChevron} ${
                      teamsOpen ? styles.channelChevronOpen : ""
                    }`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </button>

              {teamsOpen && (
                <div className={styles.channelFields}>
                  <div className={styles.formGroup}>
                    <label>Teams Aad Object ID</label>
                    <input
                      value={teamsAadObjectId ?? null}
                      onChange={(e) => setTeamsAadObjectId(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Teams From Id</label>
                    <input
                      value={teamsFromId ?? ""}
                      onChange={(e) => setTeamsFromId(e.target.value)}
                      placeholder="29:XXXXXXXXXXXX"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.sectionDivider} />
          {/* ───────────────────────── */}

          <CheckList
            label={translation("EditUserModal.tags")}
            items={allTags}
            selectedIds={selectedTagIds}
            initialSelectedIds={initialTagIds}
            onToggle={toggleTag}
            emptyText={translation("EditUserModal.noTags")}
          />

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
