"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetRequestPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("A enviar…");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // IMPORTANT: this URL must be whitelisted in
      // **Auth → URL Configuration → Redirect URLs**
      redirectTo: `${location.origin}/reset/confirm`,
      flowType: "implicit",
    });

    setMsg(
      error ? error.message : "E-mail enviado! Verifica a tua caixa de entrada."
    );
    if (!error) setEmail("");
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: "1rem", width: "min(92vw,420px)" }}
      >
        <h1>Recuperar password</h1>

        <input
          type="email"
          placeholder="tiago@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button className="btnPrimary">Enviar link</button>
        {msg && <p>{msg}</p>}
      </form>
    </main>
  );
}
