"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import styles from "../../login/login.module.css"; // one level deeper

export default function ResetConfirmPage() {
  const supabase = createClient();
  const router = useRouter();

  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMsg("Link inválido ou expirado");
        return;
      }
      setReady(true);
    })();
  }, [supabase]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("A atualizar…");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return setMsg(error.message);

    setMsg("Password atualizada! Redirecionando…");
    router.push("/login");
  }

  if (!ready) {
    return (
      <main className={styles.page}>
        <h1 className={styles.brand}>MyDigitalBot</h1>
        <p className={styles.message} style={{ textAlign: "center" }}>
          {msg || "A preparar sessão…"}
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>

      <form onSubmit={handleSubmit} className={styles.card}>
        <h1 className={styles.title}>Definir nova palavra-passe</h1>

        <label className={styles.label}>Nova palavra-passe</label>
        <input
          className={styles.input}
          type="password"
          placeholder="••••••••"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          minLength={6}
          required
        />

        <button type="submit" className={styles.btnPrimary}>
          Confirmar
        </button>

        <a href="/login" className={styles.link}>
          Voltar ao login
        </a>

        {msg && <p className={styles.message}>{msg}</p>}
      </form>
    </main>
  );
}
