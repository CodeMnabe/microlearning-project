"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";

import styles from "../scheduled.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import RecipientPicker from "./RecipientPicker";
import { toDateInputValue, toTimeParts } from "../helpers/scheduled.helpers";
import {
  cleanText,
  getRecipientForChannel,
  getRecipientKey,
  getRecipientKind,
  getRecipientSecondary,
  normalizeRecipientForChannel,
  uniqueRecipients,
} from "../helpers/recipient.helpers";

function normalizeDisplayText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (!value || typeof value !== "object") return fallback;

  return (
    value.name ||
    value.phoneNumber ||
    value.whatsappUsername ||
    value.whatsappBsuid ||
    value.birdContactId ||
    value.userId ||
    value.email ||
    fallback
  );
}

function getInitials(value) {
  const text = cleanText(value);
  if (!text) return "?";

  const parts = text.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const second = parts.length > 1 ? parts[1]?.[0] : "";

  return `${first}${second}`.toUpperCase();
}

function kindLabel(kind) {
  if (kind === "phone") return "Phone";
  if (kind === "bsuid") return "BSUID fallback";
  if (kind === "bird") return "Bird fallback";
  if (kind === "teams") return "Teams";

  return "Recipient";
}

function buildCandidate(orgUser, channel) {
  const payloadRecipient = getRecipientForChannel(orgUser, channel);

  if (!payloadRecipient) return null;

  const key = getRecipientKey(payloadRecipient, channel);

  if (!key) return null;

  const secondary = normalizeDisplayText(
    getRecipientSecondary(orgUser, channel),
    key,
  );

  const name =
    cleanText(orgUser?.name) ||
    cleanText(orgUser?.user) ||
    cleanText(orgUser?.nome) ||
    cleanText(orgUser?.email) ||
    key;

  return {
    ...orgUser,
    key,
    payloadRecipient,
    recipient: payloadRecipient,
    name,
    secondary,
    kind: getRecipientKind(payloadRecipient, channel),
    initials: getInitials(name),
  };
}

function buildEntry(recipient, candidates, channel) {
  const normalized = normalizeRecipientForChannel(recipient, channel);
  const key = getRecipientKey(normalized, channel);

  if (!normalized || !key) return null;

  const found = candidates.find((candidate) => candidate.key === key);

  if (found) return found;

  const name =
    cleanText(normalized.name) ||
    cleanText(normalized.phoneNumber) ||
    cleanText(normalized.whatsappUsername) ||
    cleanText(normalized.whatsappBsuid) ||
    cleanText(normalized.birdContactId) ||
    cleanText(normalized.email) ||
    cleanText(normalized.userId) ||
    "Unknown recipient";

  const kind = getRecipientKind(normalized, channel);

  const secondary =
    normalized.phoneNumber ||
    normalized.email ||
    normalized.whatsappUsername ||
    normalized.whatsappBsuid ||
    normalized.birdContactId ||
    normalized.userId ||
    "Sem utilizador associado";

  return {
    key,
    payloadRecipient: normalized,
    recipient: normalized,
    name,
    secondary,
    kind,
    initials: getInitials(name),
    unresolved: true,
  };
}

export default function ScheduledEditModal({
  item,
  orgUsers = [],
  usersLoading,
  translation,
  isEditModalOpen,
  closeEditModal,
  onSave,
  saving,
}) {
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    message: "",
    channel: "teams",
    date: "",
    hour: "12",
    minute: "00",
    timezone: "Europe/Lisbon",
    status: "scheduled",
    recipients: [],
    files: [],
  });

  useEffect(() => {
    if (!item) return;

    const timeParts = toTimeParts(item.scheduledFor);
    const payload = item.payload || {};
    const channel = item.channel ?? "teams";

    const rawRecipients = Array.isArray(payload.recipients)
      ? payload.recipients
      : Array.isArray(payload.userIds)
        ? payload.userIds
        : [];

    const recipients = uniqueRecipients(rawRecipients, channel);
    const files = Array.isArray(payload.files) ? payload.files : [];

    setEditForm({
      message: item.message ?? "",
      channel,
      date: toDateInputValue(item.scheduledFor),
      hour: timeParts.hour,
      minute: timeParts.minute,
      timezone: item.timezone ?? "Europe/Lisbon",
      status:
        item.status === "queued" ? "scheduled" : (item.status ?? "scheduled"),
      recipients,
      files,
    });

    setRecipientPickerOpen(false);
  }, [item]);

  const recipientCandidates = useMemo(() => {
    const safeUsers = Array.isArray(orgUsers) ? orgUsers : [];

    return safeUsers
      .map((orgUser) => buildCandidate(orgUser, editForm.channel))
      .filter(Boolean);
  }, [orgUsers, editForm.channel]);

  const currentRecipientEntries = useMemo(() => {
    const safeRecipients = Array.isArray(editForm.recipients)
      ? editForm.recipients
      : [];

    const safeCandidates = Array.isArray(recipientCandidates)
      ? recipientCandidates
      : [];

    return safeRecipients
      .map((recipient) =>
        buildEntry(recipient, safeCandidates, editForm.channel),
      )
      .filter(Boolean);
  }, [editForm.recipients, recipientCandidates, editForm.channel]);

  function removeRecipient(key) {
    setEditForm((prev) => ({
      ...prev,
      recipients: prev.recipients.filter(
        (recipient) => getRecipientKey(recipient, prev.channel) !== key,
      ),
    }));
  }

  function removeFileAt(index) {
    setEditForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    onSave({
      ...editForm,
      recipients: uniqueRecipients(editForm.recipients, editForm.channel),
    });
  }

  return (
    <div
      className={`${styles.modalOverlay} ${
        isEditModalOpen ? styles.overlayOpen : styles.overlayClosing
      }`}
      onMouseDown={closeEditModal}
    >
      <div
        className={`${styles.modal} ${
          isEditModalOpen ? styles.modalOpen : styles.modalClosing
        }`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2>{translation("EditModal.title")}</h2>
            <p className={styles.modalSubtitle}>
              Edit message, recipients, files and schedule.
            </p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={closeEditModal}
          >
            <X aria-hidden />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{translation("EditModal.message")}</span>
            <textarea
              value={editForm.message}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  message: event.target.value,
                }))
              }
              className={styles.textarea}
              rows={7}
            />
          </label>

          <div className={styles.field}>
            <div className={styles.sectionRow}>
              <div>
                <span>{translation("EditModal.recipients")}</span>
                <p className={styles.sectionHint}>
                  WhatsApp uses phone numbers first. BSUID/Bird IDs are only
                  fallbacks.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryInlineButton}
                onClick={() => setRecipientPickerOpen(true)}
              >
                <Users size={16} />
                <span>{translation("EditModal.manageRecipients")}</span>
              </button>
            </div>

            <div className={styles.recipientSummaryBox}>
              {currentRecipientEntries.length ? (
                <div className={styles.recipientPreviewList}>
                  {currentRecipientEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className={`${styles.recipientPreviewItem} ${
                        entry.unresolved ? styles.recipientPreviewWarning : ""
                      }`}
                    >
                      <div className={styles.recipientAvatar}>
                        {entry.initials}
                      </div>

                      <div className={styles.recipientPreviewInfo}>
                        <div className={styles.recipientNameLine}>
                          <strong>{entry.name}</strong>
                          <span
                            className={`${styles.recipientTypeBadge} ${
                              entry.kind === "phone"
                                ? styles.recipientTypePhone
                                : entry.kind === "bsuid" ||
                                    entry.kind === "bird"
                                  ? styles.recipientTypeFallback
                                  : ""
                            }`}
                          >
                            {kindLabel(entry.kind)}
                          </span>
                        </div>

                        <span>{entry.secondary}</span>
                      </div>

                      <button
                        type="button"
                        className={styles.recipientPreviewRemove}
                        onClick={() => removeRecipient(entry.key)}
                      >
                        {translation("EditModal.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.recipientEmptyText}>
                  {translation("EditModal.noRecipients")}
                </p>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <span>{translation("EditModal.files")}</span>

            {editForm.files.length ? (
              <div className={styles.fileList}>
                {editForm.files.map((file, index) => (
                  <div
                    key={`${file.url || file.name}-${index}`}
                    className={styles.fileRow}
                  >
                    <div className={styles.fileInfo}>
                      <strong>{file.name || "Ficheiro"}</strong>
                      <span>{file.contentType || "-"}</span>
                    </div>

                    <button
                      type="button"
                      className={styles.fileRemoveButton}
                      onClick={() => removeFileAt(index)}
                    >
                      {translation("EditModal.remove")}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.fileEmpty}>
                {translation("EditModal.noFiles")}
              </p>
            )}
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>{translation("EditModal.channel")}</span>
              <PillSelect
                value={editForm.channel}
                options={[
                  { value: "teams", label: translation("Channels.teams") },
                  {
                    value: "whatsapp",
                    label: translation("Channels.whatsapp"),
                  },
                ]}
                onChange={(newValue) =>
                  setEditForm((prev) => ({
                    ...prev,
                    channel: newValue,
                    recipients: [],
                  }))
                }
                className={styles.nativeSelect}
              />
            </label>

            <label className={styles.field}>
              <span>{translation("EditModal.status")}</span>
              <PillSelect
                value={editForm.status}
                options={[
                  {
                    value: "scheduled",
                    label: translation("Statuses.scheduled"),
                  },
                  {
                    value: "cancelled",
                    label: translation("Statuses.cancelled"),
                  },
                ]}
                onChange={(newValue) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: newValue,
                  }))
                }
                className={styles.nativeSelect}
              />
            </label>

            <label className={styles.field}>
              <span>{translation("EditModal.date")}</span>
              <input
                type="date"
                value={editForm.date}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    date: event.target.value,
                  }))
                }
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span>{translation("EditModal.timezone")}</span>
              <input
                type="text"
                value={editForm.timezone}
                className={styles.input}
                disabled
              />
            </label>
          </div>

          <div className={styles.timeRow}>
            <label className={styles.field}>
              <span>{translation("EditModal.hour")}</span>
              <input
                type="number"
                min="0"
                max="23"
                value={editForm.hour}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    hour: event.target.value,
                  }))
                }
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span>{translation("EditModal.minute")}</span>
              <input
                type="number"
                min="0"
                max="59"
                value={editForm.minute}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    minute: event.target.value,
                  }))
                }
                className={styles.input}
              />
            </label>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeEditModal}
            >
              {translation("EditModal.cancel")}
            </button>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving}
            >
              {saving
                ? translation("EditModal.saving")
                : translation("EditModal.save")}
            </button>
          </div>
        </form>

        <RecipientPicker
          translation={translation}
          isOpen={recipientPickerOpen}
          onClose={() => setRecipientPickerOpen(false)}
          initialRecipients={editForm.recipients}
          recipientCandidates={recipientCandidates}
          usersLoading={usersLoading}
          channel={editForm.channel}
          onApply={(nextRecipients = []) => {
            setEditForm((prev) => ({
              ...prev,
              recipients: uniqueRecipients(nextRecipients, prev.channel),
            }));

            setRecipientPickerOpen(false);
          }}
        />
      </div>
    </div>
  );
}
