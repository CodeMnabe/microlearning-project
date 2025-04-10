"use client";
import { useState } from "react";
import styles from "./assistants.module.css";

export default function CreateAssistantModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("gpt-3.5-turbo");
  const [topP, setTopP] = useState(0.5);
  const [temperature, setTemperature] = useState(1.0);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();

    console.log("Sending Info");

    const res = await fetch("/api/assistants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: 1, // or dynamic
        _name: name,
        _description: description,
        _instructions: instructions,
        _model: model,
        _top_p: topP,
        _temperature: temperature,
      }),
    });

    console.log("Res was created");

    if (!res.ok) {
      const error = await res.json();
      alert("Error creating assistant: " + error.error);
      return;
    }

    console.log("Res was ok");
    // all good
    onCreated(); // let parent refresh the list
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Criar Assistant</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Instruções</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Modelo</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              <option value="gpt-4">GPT-4</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>top_p: {topP}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={topP}
              onChange={(e) => setTopP(parseFloat(e.target.value))}
            />
          </div>

          <div className={styles.formGroup}>
            <label>temperature: {temperature}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />
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
