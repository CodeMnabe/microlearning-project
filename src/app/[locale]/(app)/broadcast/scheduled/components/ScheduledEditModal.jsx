"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import styles from "../scheduled.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import RecipientPicker from "./RecipientPicker";
import { toDateInputValue, toTimeParts } from "../helpers/scheduled.helpers";
import {
  getRecipientForChannel,
  getRecipientSecondary,
  mapRecipientsToEntries,
} from "../helpers/recipient.helpers";

export default function ScheduledEditModal({
  item,
  orgUsers,
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
    const recipients = Array.isArray(payload.recipients)
      ? payload.recipients
      : [];
    const files = Array.isArray(payload.files) ? payload.files : [];

    setEditForm({
      message: item.message ?? "",
      channel: item.channel ?? "teams",
      date: toDateInputValue(item.scheduledFor),
      hour: timeParts.hour,
      minute: timeParts.minute,
      timezone: item.timezone ?? "Europe/Lisbon",
      status: item.status ?? "scheduled",
      recipients,
      files,
    });

    setRecipientPickerOpen(false);
  }, [item]);

  const recipientCandidates = useMemo(() => {
    return orgUsers
      .map((orgUser) => {
        const recipient = getRecipientForChannel(orgUser, editForm.channel);
        if (!recipient) return null;

        return {
          ...orgUser,
          recipient,
          secondary: getRecipientSecondary(orgUser, editForm.channel),
        };
      })
      .filter(Boolean);
  }, [orgUsers, editForm.channel]);

  const currentEditRecipientEntries = useMemo(() => {
    return mapRecipientsToEntries(editForm.recipients, recipientCandidates);
  }, [editForm.recipients, recipientCandidates]);

  function removeRecipientFromEdit(recipient) {
    setEditForm((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((value) => value !== recipient),
    }));
  }

  function removeFileAt(index) {
    setEditForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(editForm);
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
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <h2>{translation("EditModal.title")}</h2>
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
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  message: e.target.value,
                }))
              }
              className={styles.textarea}
              rows={7}
            />
          </label>

          <div className={styles.field}>
            <div className={styles.sectionRow}>
              <span>{translation("EditModal.recipients")}</span>
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
              {currentEditRecipientEntries.length ? (
                <div className={styles.recipientPreviewList}>
                  {currentEditRecipientEntries.map((entry) => (
                    <div
                      key={entry.recipient}
                      className={styles.recipientPreviewItem}
                    >
                      <div className={styles.recipientPreviewInfo}>
                        <strong>{entry.name}</strong>
                        <span>{entry.secondary}</span>
                      </div>

                      <button
                        type="button"
                        className={styles.recipientPreviewRemove}
                        onClick={() => removeRecipientFromEdit(entry.recipient)}
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
                  <div key={`${file.url}-${index}`} className={styles.fileRow}>
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
                    value: "failed",
                    label: translation("Statuses.failed"),
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
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    date: e.target.value,
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
                style={{ color: "gray" }}
                disabled={true}
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
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    hour: e.target.value,
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
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    minute: e.target.value,
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
          onApply={(nextRecipients) => {
            setEditForm((prev) => ({
              ...prev,
              recipients: nextRecipients,
            }));
            setRecipientPickerOpen(false);
          }}
        />
      </div>
    </div>
  );
}
