"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client"; // <- the browser client helper you already made
import styles from "./login.module.css";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { stopLoading } = useGlobalLoader();

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) router.replace("/users"); // <— your target page
    })();
  }, [supabase, router, stopLoading]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleAuth(e, mode) {
    e.preventDefault();
    setMsg("A trabalhar…");

    let error;
    if (mode === "signup") {
      ({ error } = await supabase.auth.signUp({ email, password }));
    } else {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    }

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Sucesso! A redirecionar…");
    router.push("/users");
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.brand}>MyDigitalBot</h1>
      <form className={styles.card}>
        <h1 className={styles.title}>Entrar</h1>

        <label className={styles.label}>E-mail</label>
        <input
          className={styles.input}
          type="email"
          placeholder="exemplo@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className={styles.label}>Palavra-Passe</label>
        <input
          className={styles.input}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          className={styles.btnPrimary}
          onClick={(e) => handleAuth(e, "login")}
        >
          Iniciar sessão
        </button>

        {/*
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={(e) => handleAuth(e, "signup")}
        >
          Criar conta
        </button>
         */}

        <a href="/reset" className={styles.link}>
          Esqueceu a palavra-passe?
        </a>

        {msg && <p className={styles.message}>{msg}</p>}
      </form>
    </main>
  );
}
