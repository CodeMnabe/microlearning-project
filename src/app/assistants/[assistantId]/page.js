"use client";
import { useEffect, useState, useCallback } from "react";
import styles from "./assistantDetail.module.css";
import { useGlobalLoader } from "../../LoadingScreen/GlobalLoaderContext";
import ChatSandbox from "./Chatbox/Chatbox";
import { useParams } from "next/navigation";

export default function AssistantDetailPage({ params }) {
  const { assistantId } = useParams();
  const [assistant, setAssistant] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoader();
  const [vectorStore, setVectorStore] = useState(null);
  const [vsName, setVsName] = useState("");
  const [vsFiles, setVsFiles] = useState([]);

  const fetchAssistant = useCallback(async () => {
    startLoading();
    try {
      const res = await fetch(`/api/assistants/${assistantId}`);
      const data = await res.json();
      setAssistant(data);

      if (data.vectorStoreId) {
        const res = await fetch(
          `/api/assistants/${assistantId}/vector-store/${data.vectorStoreId}`
        );
        const store = await res.json();
        setVectorStore(store);
      } else {
        setVectorStore(null);
      }
    } catch (err) {
      console.error("Error fetching assistant:", err);
    } finally {
      stopLoading();
    }
  }, [assistantId, startLoading, stopLoading]);

  useEffect(() => {
    fetchAssistant();
  }, [fetchAssistant]);

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
          open_ai_id: assistant.open_ai_id,
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

  async function deleteAssistant() {
    try {
      const res = await fetch(`/api/assistants/${assistantId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        alert("Erro: " + error.error);
      } else {
        const data = await res.json();
        console.log(data);
      }
    } catch (error) {
      console.error("Error deleting Assistant:", err);
    } finally {
      window.location.href = `/assistants`;
    }
  }

  async function deleteVectorStore() {
    startLoading();
    try {
      const res = await fetch(
        `/api/assistants/${assistantId}/vector-store/${vectorStore.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        alert("Erro: " + error.error);
      } else {
        const data = await res.json();
        console.log(data);
      }
    } catch (err) {
      console.error("Error deleting Vector Store:", err);
    } finally {
      await fetchAssistant();
    }
  }

  async function handleAddVectorStore() {
    startLoading();
    try {
      const fd = new FormData();
      fd.append("storeName", vsName);
      vsFiles.forEach((file) => fd.append("files", file));

      const res = await fetch(`/api/assistants/${assistant.id}/vector-store`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        alert("Erro: " + data.error);
      } else {
        setVsName("");
        setVsFiles([]);
        stopLoading();
        await fetchAssistant();
      }
    } catch (err) {
      alert("Falha: " + err.message);
    }
  }

  if (!assistant)
    return <p className={styles.loading}>A carregar assistente...</p>;

  return (
    <div className={styles.splitContainer}>
      <div className={styles.leftPane}>
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
            <span>{new Date(assistant.created_at).toLocaleString()}</span>
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
              <>
                <button onClick={() => setIsEditing(true)}>Editar</button>
                <button onClick={() => deleteAssistant()}>Eliminar</button>
              </>
            )}
          </div>
        </div>
        <div className={styles.card} style={{ marginTop: 24 }}>
          {!assistant.vectorStoreId ? (
            // SHOW FORM if no vector store yet
            <>
              <h3>Adicionar Vector Store</h3>

              <label className={styles.label}>Nome da store:</label>
              <input
                className={styles.input}
                value={vsName}
                onChange={(e) => setVsName(e.target.value)}
                placeholder="Ex: HR-Docs"
              />

              <label className={styles.label} style={{ marginTop: 12 }}>
                Ficheiros (pode escolher vários):
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => setVsFiles(Array.from(e.target.files))}
                className={styles.input}
              />

              <button
                style={{ marginTop: 16 }}
                onClick={handleAddVectorStore}
                disabled={!vsName.trim() || vsFiles.length === 0}
              >
                Criar e associar
              </button>
            </>
          ) : (
            // SHOW INFO if store(s) exist
            <>
              <h3>Vector Store Associada</h3>
              <div>
                <p>
                  Store ID: <strong>{assistant.vectorStoreId}</strong>
                </p>
                {vectorStore && (
                  <>
                    <p>
                      Nome: <strong>{vectorStore.storeName}</strong>
                    </p>
                    <p>
                      Número de ficheiros:{" "}
                      <strong>{vectorStore.fileIds?.length}</strong>
                    </p>

                    <button onClick={() => deleteVectorStore()}>
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className={styles.rightPane}>
        <ChatSandbox assistant={assistant} />
      </div>
    </div>
  );
}
