"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetConfirmPage() {
  const supabase = createClient();
  const router = useRouter();

  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);

  // detectSessionInUrl:true will already parse the hash on first render
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
      <p style={{ textAlign: "center", marginTop: "20vh" }}>
        {msg || "A preparar sessão…"}
      </p>
    );
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: "1rem", width: "min(92vw,420px)" }}
      >
        <h1>Nova password</h1>

        <input
          type="password"
          placeholder="••••••••"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          minLength={6}
          required
        />

        <button className="btnPrimary">Definir</button>
        {msg && <p>{msg}</p>}
      </form>
    </main>
  );
}
