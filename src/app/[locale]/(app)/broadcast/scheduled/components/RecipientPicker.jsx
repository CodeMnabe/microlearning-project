"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserMinus, UserPlus, X } from "lucide-react";
import styles from "../scheduled.module.css";
import { mapRecipientsToEntries } from "../helpers/recipient.helpers";

export default function RecipientPicker({
  translation,
  isOpen,
  onClose,
  initialRecipients,
  recipientCandidates,
  usersLoading,
  onApply,
}) {
  const [query, setQuery] = useState("");
  const [draftRecipients, setDraftRecipients] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    setQuery("");
    setDraftRecipients([...new Set(initialRecipients || [])]);
  }, [isOpen, initialRecipients]);

  const selectedRecipientEntries = useMemo(() => {
    return mapRecipientsToEntries(draftRecipients, recipientCandidates);
  }, [draftRecipients, recipientCandidates]);

  const filteredSelectedRecipientEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectedRecipientEntries;

    return selectedRecipientEntries.filter((candidate) => {
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.recipient,
        candidate.secondary,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [selectedRecipientEntries, query]);

  const availableRecipientEntries = useMemo(() => {
    const q = query.trim().toLowerCase();

    return recipientCandidates.filter((candidate) => {
      if (draftRecipients.includes(candidate.recipient)) return false;
      if (!q) return true;

      const haystack = [
        candidate.name,
        candidate.email,
        candidate.recipient,
        candidate.secondary,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [recipientCandidates, draftRecipients, query]);

  function toggleDraftRecipient(recipient) {
    setDraftRecipients((prev) =>
      prev.includes(recipient)
        ? prev.filter((value) => value !== recipient)
        : [...prev, recipient],
    );
  }

  if (!isOpen) return null;

  return (
    <div className={styles.pickerOverlay} onMouseDown={onClose}>
      <div
        className={styles.pickerModal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2>{translation("RecipientPicker.title")}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            <X aria-hidden />
          </button>
        </div>

        <div className={styles.pickerToolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <Search size={18} />
            </span>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.searchInput}
              placeholder={translation("RecipientPicker.searchPlaceholder")}
            />
          </div>

          <div className={styles.pickerCount}>
            {draftRecipients.length}{" "}
            {translation("RecipientPicker.countSelected")}
          </div>
        </div>

        <div className={styles.pickerGrid}>
          <section className={styles.pickerColumn}>
            <div className={styles.pickerColumnHeader}>
              <h3>{translation("RecipientPicker.selected")}</h3>
            </div>

            <div className={styles.pickerList}>
              {filteredSelectedRecipientEntries.length ? (
                filteredSelectedRecipientEntries.map((entry) => (
                  <div
                    key={`selected-${entry.recipient}`}
                    className={styles.pickerRow}
                  >
                    <div className={styles.pickerUserInfo}>
                      <strong>{entry.name}</strong>
                      <span>{entry.secondary}</span>
                    </div>

                    <button
                      type="button"
                      className={styles.recipientRemoveButton}
                      onClick={() => toggleDraftRecipient(entry.recipient)}
                    >
                      <UserMinus size={16} />
                      <span>{translation("RecipientPicker.remove")}</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.recipientEmptyText}>
                  {translation("RecipientPicker.noRecipient")}
                </p>
              )}
            </div>
          </section>

          <section className={styles.pickerColumn}>
            <div className={styles.pickerColumnHeader}>
              <h3>{translation("RecipientPicker.available")}</h3>
            </div>

            <div className={styles.pickerList}>
              {usersLoading ? (
                <p className={styles.recipientEmptyText}>
                  {translation("RecipientPicker.loading")}
                </p>
              ) : availableRecipientEntries.length ? (
                availableRecipientEntries.map((entry) => (
                  <div
                    key={`available-${entry.recipient}`}
                    className={styles.pickerRow}
                  >
                    <div className={styles.pickerUserInfo}>
                      <strong>{entry.name}</strong>
                      <span>{entry.secondary}</span>
                    </div>

                    <button
                      type="button"
                      className={styles.recipientAddButton}
                      onClick={() => toggleDraftRecipient(entry.recipient)}
                    >
                      <UserPlus size={16} />
                      <span>{translation("RecipientPicker.add")}</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.recipientEmptyText}>
                  {translation("RecipientPicker.emptyRecipient")}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            {translation("RecipientPicker.cancel")}
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => onApply([...new Set(draftRecipients)])}
          >
            {translation("RecipientPicker.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
