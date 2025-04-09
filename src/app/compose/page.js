"use client";
import { useState } from "react";
import styles from "./compose.module.css";

export default function ComposePage() {
  const [countryCode, setCountryCode] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setResponse(null);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(`Mensagem enviada com SID: ${data.sid}`);
      } else {
        const errorData = await res.json();
        setResponse(`Erro ao enviar: ${errorData.error}`);
      }
    } catch (error) {
      setResponse(`Erro (fetch): ${error.message}`);
    }
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Enviar Mensagem WhatsApp</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Telefone de destino (para Portugal +351):
          </label>
          <input
            className={styles.input}
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="910022787"
            required
          />

          <label className={styles.label}>Mensagem:</label>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
          />

          <button type="submit" className={styles.button}>
            Enviar
          </button>
        </form>

        {response && <p className={styles.response}>{response}</p>}
      </div>
    </div>
  );
}
