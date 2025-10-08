"use client";
import { useEffect, useState } from "react";

export default function EditUserModal({ open, onClose, user, orgId, onSaved }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // tags
  const [allTags, setAllTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  useEffect(() => {
    if (!open || !user) return;
    setName(user.name || "");
    setPhone(user.phone || user.phone_number || "");
    setSelectedTagIds(user.tagIds || user.tag_ids || []);
  }, [open, user]);

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      try {
        const res = await fetch(`/api/tags?orgId=${orgId}`);
        const data = await res.json();
        setAllTags(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setAllTags([]);
      }
    })();
  }, [open, orgId]);

  if (!open || !user) return null;

  function toggleTag(id) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name,
          phoneNumber: phone,
          tagIds: selectedTagIds, // 👈 send full set
        }),
      });
      if (!res.ok) {
        console.error(await res.text());
        return;
      }
      const updated = await res.json();
      onSaved?.(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 9998,
  };
  const card = {
    width: "min(460px, 92vw)",
    background: "#fff",
    color: "#0f1c3f",
    borderRadius: 14,
    border: "1px solid #e5edf5",
    boxShadow: "0 20px 60px rgba(0,0,0,.25)",
    padding: "1.25rem",
  };
  const tagList = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
    gap: 8,
    marginBottom: 14,
  };
  const chip = (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 9999,
    border: active ? "1px solid #0ea5e9" : "1px solid #e5edf5",
    background: active ? "#eaf6ff" : "#f7fbff",
    cursor: "pointer",
    userSelect: "none",
  });

  return (
    <div style={overlay} role="dialog" aria-modal="true">
      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Editar Utilizador</h3>

        <label>Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #e5edf5",
            borderRadius: 10,
            marginBottom: 10,
          }}
        />

        <label>Telefone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid #e5edf5",
            borderRadius: 10,
            marginBottom: 16,
          }}
        />

        <label>Tags</label>
        <div style={tagList}>
          {allTags.map((t) => {
            const active = selectedTagIds.includes(t.id);
            return (
              <label key={t.id} style={chip(active)}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleTag(t.id)}
                  style={{ accentColor: "#0ea5e9" }}
                />
                <span>{t.name}</span>
              </label>
            );
          })}
          {!allTags.length && (
            <div style={{ color: "#9aa3b2" }}>Sem tags disponíveis.</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "#eef3f7",
              border: 0,
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: "linear-gradient(135deg,#0ea5e9,#7cc2ff)",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            {saving ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
