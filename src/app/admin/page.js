"use client";
import { useState } from "react";
import styles from "./admin.module.css";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";

export default function AdminPage() {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Unknown error");
      }

      const { org } = await res.json();
      setMsg(`✔️ Criada organização #${org.id}: «${org.name}»`);
      setName("");
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}
    >
      <h1>Nova organização</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da organização…"
          required
          style={{ flex: 1, padding: 8 }}
        />
        <button disabled={submitting}>
          {submitting ? "A criar…" : "Criar"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
    </main>
  );
}
