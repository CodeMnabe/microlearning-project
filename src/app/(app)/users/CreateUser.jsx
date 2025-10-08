// components/CreateUserModal.jsx
import { useState, useEffect } from "react";
import styles from "./users.module.css";

export default function CreateUserModal({
  isOpen,
  onClose,
  onCreateUser,
  assistants = [],
}) {
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [assistantId, setAssistantId] = useState("");

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
      assistantId: assistantId ? Number(assistantId) : null,
    });
    setUserName("");
    setPhoneNumber("");
  };

  if (!render) return null;

  // Pick the animation state class
  const stateClass = isOpen ? styles.open : styles.closing;

  return (
    <div
      className={`${styles.modalOverlay} ${stateClass}`}
      // When the overlay finishing closing, unmount
      onAnimationEnd={(e) => {
        if (!isOpen && e.target === e.currentTarget) setRender(false);
      }}
      onClick={(e) => {
        // click outside to close
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modalContent} ${stateClass}`}
        role="dialog"
        aria-modal="true"
      >
        <h3 className={styles.modalTitle}>Criar um novo Utilizador</h3>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="nome">Nome do Utilizador:</label>
            <input
              id="nome"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="telefone">Número de Telemóvel:</label>
            <input
              id="telefone"
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="assistant">Assistente:</label>
            <select
              id="assistant"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
            >
              {assistants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit">Criar</button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
