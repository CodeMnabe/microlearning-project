"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./assistants.module.css";

export default function CreateAssistantModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [topP, setTopP] = useState(0.5);
  const [temperature, setTemperature] = useState(1.0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [isOpen, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch("/api/assistants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: 1, // or dynamic
        name: name,
        description: description,
        instructions: instructions,
        model: model,
        top_p: topP,
        temperature: temperature,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert("Error creating assistant: " + error.error);
      return;
    }

    // all good
    onCreated(); // let parent refresh the list
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Criar novo Assistente</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>
              Nome
              <span
                className={styles.infoIcon}
                data-tooltip="Nome que vai ficar associado ao Assistant."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              Descrição
              <span
                className={styles.infoIcon}
                data-tooltip="Uma breve descrição sobre o Assistant."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              Instruções
              <span
                className={styles.infoIcon}
                data-tooltip="Instruções que o Assistant vai seguir."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              Modelo
              <span
                className={styles.infoIcon}
                data-tooltip="Modelo de Inteligência Artificial que o Assistant vai utilizar."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              {/* <option value="gpt-4o">GPT-4o</option> */}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>
              Criatividade
              <span
                className={styles.infoIcon}
                data-tooltip="Controla a variedade das respostas: com o valor 0.5, o Assistant escolhe entre as opções com maior probabilidade, limitando-se às mais relevantes."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>{topP.toFixed(2)}</span>
              <input
                type="range"
                min="0.00"
                max="1.00"
                step="0.01"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>
              Variedade
              <span
                className={styles.infoIcon}
                data-tooltip="Controla a aleatoriedade das respostas: quanto mais baixo for o valor, mais previsíveis e repetitivas serão as respostas. Ao aproximar-se de zero, o Assistant torna-se mais determinístico."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                {temperature.toFixed(2)}
              </span>
              <input
                type="range"
                min="0.00"
                max="2.00"
                step="0.01"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>
          <div className={styles.buttonGroup}>
            <button type="submit">Criar</button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
