// /app/assistants/Chatbox/Chatbox.jsx
"use client";
import { useState } from "react";
import styles from "../assistants.module.css";
import { useTranslations } from "next-intl";
import { useAlert } from "@/app/components/Alert/AlertProvider";

export default function ChatSandbox({ assistant }) {
  const translation = useTranslations();
  const showAlert = useAlert();
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const trimmedInput = input.trim();

  async function handleSend(e) {
  e.preventDefault();

  

  

  if (!assistant?.id) {
    await showAlert({
      title: translation("Chatbox.alerts.missingAssistant.title"),
      message: translation("Chatbox.alerts.missingAssistant.message"),
      tone: "warning",
    });

    return;
  }

  if (!assistant?.open_ai_id) {
    await showAlert({
      title: translation("Chatbox.alerts.missingOpenAiId.title"),
      message: translation("Chatbox.alerts.missingOpenAiId.message"),
      tone: "warning",
    });

    return;
  }

  const newUserMsg = { role: "user", content: trimmedInput };

  setMessages((prev) => [newUserMsg, ...prev]);
  setInput("");
  setIsSending(true);

  try {
    const res = await fetch(`/api/assistants/${assistant.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: assistant.open_ai_id,
        message: trimmedInput,
        threadId,
      }),
    });

    const data = await res.json().catch(() => ({}));

   if (!res.ok) {
  setMessages((prev) => [
    {
      role: "system",
      content: translation("Chatbox.alerts.apiError.message"),
    },
    ...prev,
  ]);

  return;
}
    
   

    if (!data.reply) {
      setMessages((prev) => [
        {
          role: "system",
          content: translation("Chatbox.errorReply"),
        },
        ...prev,
      ]);

      await showAlert({
        title: translation("Chatbox.alerts.emptyReply.title"),
        message: translation("Chatbox.alerts.emptyReply.message"),
        tone: "warning",
      });

      return;
    }

    setMessages((prev) => [
      { role: "assistant", content: data.reply },
      ...prev,
    ]);

        setThreadId(data.threadId || threadId);
      } catch (err) {
        console.warn("[Chatbox] send message error:", err);

        setMessages((prev) => [
          { role: "system", content: translation("Chatbox.errorApi") },
          ...prev,
        ]);

        await showAlert({
          title: translation("Chatbox.alerts.networkError.title"),
          message: translation("Chatbox.alerts.networkError.message"),
          tone: "danger",
        });
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
          className={`${styles.ctaPrimary} ${styles.sendBtn}`}
          disabled={isSending || !input.trim()}
        >
          {translation("Chatbox.send")}
        </button>
      </form>
    </div>
  );
}
