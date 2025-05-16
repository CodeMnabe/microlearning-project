"use client";
import { useState } from "react";
import styles from "./chatbox.module.css";

export default function ChatSandbox({ assistant }) {
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    const newUserMsg = { role: "user", content: input };

    setMessages((prev) => [newUserMsg, ...prev]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/assistants/${assistant.id}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: assistant.openAiId,
          message: input,
          threadId: threadId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        setMessages((prev) => [
          { role: "assistant", content: data.reply },
          ...prev,
        ]);
        setThreadId(data.threadId);
      } else {
        setMessages((prev) => [
          { role: "system", content: data.error || "Erro na resposta" },
          ...prev,
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        { role: "system", content: "Erro ao comunicar com a API." },
        ...prev,
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.headline}>
        Experimentar assistente{" "}
        {threadId && (
          <span className={styles.threadBadge}>
            Thread&nbsp;ID:&nbsp;{threadId}
          </span>
        )}
      </h2>

      <div className={styles.viewport}>
        {isSending && <div className={styles.assistant}>...</div>}
        {messages.map((m, i) => (
          <div key={i} className={styles[m.role]}>
            {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className={styles.form}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreve a tua mensagem..."
        />
        <button disabled={isSending || !input.trim()}>Enviar</button>
      </form>
    </div>
  );
}
