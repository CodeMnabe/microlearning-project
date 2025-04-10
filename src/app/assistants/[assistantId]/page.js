"use client";
import { useEffect, useState } from "react";

export default function AssistantDetailPage({ params }) {
  const { assistantId } = params;
  const [assistant, setAssistant] = useState(null);

  useEffect(() => {
    async function fetchAssistant() {
      try {
        const res = await fetch(`/api/assistants/${assistantId}`);
        const data = await res.json();
        setAssistant(data);
      } catch (err) {
        console.error("Error fetching assistant:", err);
      }
    }
    fetchAssistant();
  }, [assistantId]);

  if (!assistant) {
    return <p>Loading assistant details...</p>;
  }

  return (
    <div>
      <h1>{assistant.name}</h1>
      <p>{assistant.description}</p>
      {/* Add more fields, etc. */}
    </div>
  );
}
