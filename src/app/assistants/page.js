"use client";
import { useState, useEffect } from "react";
import styles from "./assistants.module.css";
import CreateAssistantModal from "./CreateAssistantModal";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";
// we'll create a modal component for creating an assistant

export default function AssistantsPage() {
  const [assistants, setAssistants] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoader();

  // Fetch all assistants for orgId=1 on load
  useEffect(() => {
    async function fetchAssistants() {
      startLoading();
      try {
        const res = await fetch("/api/assistants?orgId=1");
        const data = await res.json();
        console.log(data);
        setAssistants(data || []);
      } catch (err) {
        console.error("Error fetching assistants:", err);
      } finally {
        stopLoading();
      }
    }
    fetchAssistants();
  }, [startLoading, stopLoading]);

  // Handler to open/close the create assistant modal
  function handleCreateAssistantClick() {
    setIsModalOpen(true);
  }

  // This is called inside the modal after creating the assistant
  async function handleAssistantCreated() {
    const updatedAssistants = await fetch(`/api/assistants?orgId=${1}`).then(
      (r) => r.json()
    );
    setAssistants(updatedAssistants);
    setIsModalOpen(false);
  }

  // For clicking on an assistant to see details
  function handleAssistantClick(assistantId) {
    // e.g. navigate to /assistants/[assistantId]
    // In Next.js 13 App Router, you might do:
    window.location.href = `/assistants/${assistantId}`;
  }

  const hasNoAssistants = assistants.length === 0;

  return (
    <div className={styles.mainContent}>
      <h2>Assistants</h2>
      {hasNoAssistants ? (
        <div className={styles.centerWrapper}>
          <button
            onClick={handleCreateAssistantClick}
            className={styles.bigButton}
          >
            Criar Assistant
          </button>
        </div>
      ) : (
        <div className={styles.assistantsColumn}>
          {assistants.map((assistant) => (
            <div
              key={assistant.id}
              className={styles.assistantCard}
              onClick={() => handleAssistantClick(assistant.id)}
            >
              <h3>{assistant.name}</h3>
              <p>{assistant.description}</p>
            </div>
          ))}
          <button
            onClick={handleCreateAssistantClick}
            className={styles.createMoreButton}
          >
            +
          </button>
        </div>
      )}
      <CreateAssistantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleAssistantCreated}
      />
    </div>
  );
}
