"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import styles from "../login/login.module.css"; // reuse login styles

export default function ResetRequestPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("A enviar…");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset/confirm`,
      flowType: "implicit",
    });

    setMsg(
      error
        ? error.message
        : "E-mail enviado! Verifique a sua caixa de entrada."
    );
    if (!error) setEmail("");
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>

      <form onSubmit={handleSubmit} className={styles.card}>
        <h1 className={styles.title}>Recuperar palavra-passe</h1>

        <label className={styles.label}>E-mail</label>
        <input
          className={styles.input}
          type="email"
          placeholder="exemplo@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" className={styles.btnPrimary}>
          Enviar link
        </button>

        <a href="/login" className={styles.link}>
          Voltar ao login
        </a>

        {msg && <p className={styles.message}>{msg}</p>}
      </form>
    </main>
  );
}
