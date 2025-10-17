// /app/assistants/Chatbox/Chatbox.jsx
"use client";
import { useState } from "react";
import styles from "./chatbox.module.css";
import ui from "../assistants.module.css"; // 👈 import shared button style
import { useTranslations } from "next-intl";

export default function ChatSandbox({ assistant }) {
  const translation = useTranslations();
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const newUserMsg = { role: "user", content: input };

    setMessages((prev) => [newUserMsg, ...prev]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/assistants/${assistant.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: assistant.open_ai_id,
          message: input,
          threadId,
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
          {
            role: "system",
            content: data.error || `${translation("Chatbox.errorReply")}`,
          },
          ...prev,
        ]);
      }
    } catch {
      setMessages((prev) => [
        { role: "system", content: `${translation("Chatbox.errorApi")}` },
        ...prev,
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.headline}>
        {translation("Chatbox.try")}{" "}
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
          placeholder={translation("Chatbox.placeholder")}
        />
        {/* 👇 same pill style as "Criar e Associar" */}
        <button
          type="submit"
          className={`${ui.ctaPrimary} ${styles.sendBtn}`}
          disabled={isSending || !input.trim()}
        >
          {translation("Chatbox.send")}
        </button>
      </form>
    </div>
  );
}
