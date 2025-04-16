"use client";
import { use, useEffect, useState } from "react";
import styles from "./assistantDetail.module.css";
import { useGlobalLoader } from "../../LoadingScreen/GlobalLoaderContext";

export default function AssistantDetailPage({ params }) {
  const { assistantId } = use(params);
  const [assistant, setAssistant] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoader();

  useEffect(() => {
    async function fetchAssistant() {
      startLoading();
      try {
        const res = await fetch(`/api/assistants/${assistantId}`);
        const data = await res.json();
        setAssistant(data);
      } catch (err) {
        console.error("Error fetching assistant:", err);
      } finally {
        stopLoading();
      }
    }
    fetchAssistant();
  }, [assistantId, startLoading, stopLoading]);

  function handleChange(field, value) {
    setAssistant((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assistants/${assistantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: assistant.id,
          openAiId: assistant.openAiId,
          name: assistant.name,
          description: assistant.description,
          instructions: assistant.instructions,
          model: assistant.model,
          temperature: assistant.temperature,
          top_p: assistant.top_p,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert("Erro ao guardar: " + error.error);
      } else {
        setIsEditing(false);
      }
    } catch (err) {
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!assistant)
    return <p className={styles.loading}>A carregar assistente...</p>;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {isEditing ? (
          <>
            <input
              className={styles.input}
              value={assistant.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
            <input
              className={styles.input}
              value={assistant.description}
              maxLength={50}
              onChange={(e) => handleChange("description", e.target.value)}
            />
            <textarea
              className={styles.textareaLarge}
              value={assistant.instructions}
              onChange={(e) => handleChange("instructions", e.target.value)}
            />
          </>
        ) : (
          <>
            <h1 className={styles.name}>{assistant.name}</h1>
            <p className={styles.description}>{assistant.description}</p>
            <p className={styles.instructions}>{assistant.instructions}</p>
          </>
        )}

        <div className={styles.detailGroup}>
          <label>Top P:</label>
          {isEditing ? (
            <div className={styles.sliderGroup}>
              <span className={styles.sliderValue}>
                {assistant.top_p.toFixed(2)}
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={assistant.top_p}
                onChange={(e) =>
                  handleChange("top_p", parseFloat(e.target.value))
                }
              />
            </div>
          ) : (
            <span>{assistant.top_p}</span>
          )}
        </div>

        <div className={styles.detailGroup}>
          <label>Temperatura:</label>
          {isEditing ? (
            <div className={styles.sliderGroup}>
              <span className={styles.sliderValue}>
                {assistant.temperature.toFixed(2)}
              </span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={assistant.temperature}
                onChange={(e) =>
                  handleChange("temperature", parseFloat(e.target.value))
                }
              />
            </div>
          ) : (
            <span>{assistant.temperature}</span>
          )}
        </div>

        <div className={styles.detailGroup}>
          <label>Modelo:</label>
          {isEditing ? (
            <select
              className={styles.select}
              value={assistant.model}
              onChange={(e) => handleChange("model", e.target.value)}
            >
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              <option value="gpt-4">gpt-4</option>
            </select>
          ) : (
            <span>{assistant.model}</span>
          )}
        </div>

        <div className={styles.detailGroup}>
          <label>ID OpenAI:</label>
          <span>{assistant.openAiId}</span>
        </div>

        <div className={styles.detailGroup}>
          <label>Criado em:</label>
          <span>{new Date(assistant.createdAt).toLocaleString()}</span>
        </div>

        <div className={styles.buttonGroup}>
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "A guardar..." : "Guardar"}
              </button>
              <button onClick={() => setIsEditing(false)}>Cancelar</button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)}>Editar</button>
          )}
        </div>
      </div>
    </div>
  );
}
