// components/CreateUserModal.jsx
"use client";
import { useState, useEffect } from "react";
import styles from "./users.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import { useTranslations } from "next-intl";

export default function CreateUserModal({
  isOpen,
  onClose,
  onCreateUser,
  assistants = [],
}) {
  const translation = useTranslations();
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [assistantId, setAssistantId] = useState(null); // number | null

  // Keep the modal mounted while running the closing animation
  const [render, setRender] = useState(isOpen);
  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  // ESC to close (only when open)
  useEffect(() => {
    if (!render) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateUser({
      userName,
      phoneNumber,
      email,
      assistantId: assistantId ?? null, // already numeric
    });
    setUserName("");
    setPhoneNumber("");
    setEmail("");
    setAssistantId(null);
  };

  if (!render) return null;

  const stateClass = isOpen ? styles.open : styles.closing;

  return (
    <div
      className={`${styles.modalOverlay} ${stateClass}`}
      onAnimationEnd={(e) => {
        if (!isOpen && e.target === e.currentTarget) setRender(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modalContent} ${stateClass}`}
        role="dialog"
        aria-modal="true"
      >
        <h3 className={styles.modalTitle}>
          {translation("CreateUserModal.title")}
        </h3>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="nome">
              {translation("CreateUserModal.userName")}
            </label>
            <input
              id="nome"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="telefone">
              {translation("CreateUserModal.phone")}
            </label>
            <input
              id="telefone"
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">
              {translation("CreateUserModal.email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("CreateUserModal.assistant")}</label>
            <PillSelect
              options={assistants.map((a) => ({ value: a.id, label: a.name }))}
              value={assistantId ?? ""}
              onChange={(val) => setAssistantId(val)} // val is the selected id (number)
              placeholder={translation("CreateUserModal.chooseAssistant")}
              fullWidth // ⟵ stretch to the form width
              portalToBody
            />
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit">
              {translation("CreateUserModal.create")}
            </button>
            <button type="button" onClick={onClose}>
              {translation("CreateUserModal.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
