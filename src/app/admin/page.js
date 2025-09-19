"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";

export default function AdminPage() {
  const supabase = createClient();
  const { stopLoading } = useGlobalLoader();

  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]); // [{ id, name, theme }]
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    stopLoading();
  }, [stopLoading]);

  // 1) who is logged in?
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(user || null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) load orgs for owner
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("organization")
        .select("id, name, theme, logo_url")
        .eq("owner_user_id", user.id)
        .order("id", { ascending: true });

      if (error) {
        console.error(error);
        setMsg("❌ Falha a carregar as organizações");
      } else {
        // ensure theme defaults exist for UI
        const withDefaults = (data || []).map((o) => ({
          ...o,
          theme: {
            primary: o.theme?.primary || "#4f46e5",
            secondary: o.theme?.secondary || "#0ea5e9",
          },
        }));
        setOrgs(withDefaults);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Helpers
  function setCssVars(theme) {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.primary);
    root.style.setProperty("--color-secondary", theme.secondary);
  }

  // 3) local edit handlers
  function handleColorChange(orgId, key, value) {
    setOrgs((prev) =>
      prev.map((o) =>
        o.id === orgId ? { ...o, theme: { ...o.theme, [key]: value } } : o
      )
    );
  }

  // 4) save to supabase
  async function handleSave(org) {
    setSavingId(org.id);
    setMsg(null);
    try {
      const payload = {
        theme: { primary: org.theme.primary, secondary: org.theme.secondary },
      };

      const { data, error } = await supabase
        .from("organization")
        .update(payload)
        .eq("id", org.id)
        .select("id, name, theme")
        .single();

      if (error) throw error;

      // update local list with canonical values from DB
      setOrgs((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, theme: data.theme } : o))
      );

      // reflect immediately in app theme (optional)
      setCssVars(data.theme);

      setMsg(`✓ Tema guardado para «${org.name}».`);
    } catch (err) {
      console.error(err);
      setMsg("❌ Não foi possível guardar o tema.");
    } finally {
      setSavingId(null);
    }
  }

  // 5) (optional) create org – keep your existing code if you still want it.
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setMsg(null);
    try {
      // create via API or directly; here’s a direct insert with defaults:
      const defTheme = { primary: "#4f46e5", secondary: "#0ea5e9" };
      const { data, error } = await supabase
        .from("organization")
        .insert([{ name, owner_user_id: user.id, theme: defTheme }])
        .select("id, name, theme")
        .single();

      if (error) throw error;
      setOrgs((prev) => [...prev, data]);
      setName("");
      setMsg(`✓ Criada organização #${data.id}: «${data.name}»`);
    } catch (err) {
      console.error(err);
      setMsg("❌ Erro ao criar organização.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main
      style={{ maxWidth: 720, margin: "3rem auto", fontFamily: "sans-serif" }}
    >
      <h1 style={{ marginBottom: 16 }}>Admin</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Nova organização</h2>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da organização…"
            required
            style={{ flex: 1, padding: 8 }}
          />
          <button disabled={creating}>{creating ? "A criar…" : "Criar"}</button>
        </form>
      </section>

      <section>
        <h2 style={{ marginBottom: 8 }}>Temas</h2>
        {loading && <p>A carregar…</p>}
        {!loading && orgs.length === 0 && <p>Sem organizações.</p>}

        {orgs.map((org) => (
          <div
            key={org.id}
            style={{
              border: "1px solid #e5e7eb",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                #{org.id} — {org.name}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ width: 80 }}>Primary</span>
                  <input
                    type="color"
                    value={org.theme.primary}
                    onChange={(e) =>
                      handleColorChange(org.id, "primary", e.target.value)
                    }
                    style={{
                      width: 40,
                      height: 32,
                      padding: 0,
                      border: "none",
                      background: "none",
                    }}
                  />
                  <input
                    value={org.theme.primary}
                    onChange={(e) =>
                      handleColorChange(org.id, "primary", e.target.value)
                    }
                    style={{ width: 110, padding: "6px 8px" }}
                  />
                </label>

                <label
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ width: 80 }}>Secondary</span>
                  <input
                    type="color"
                    value={org.theme.secondary}
                    onChange={(e) =>
                      handleColorChange(org.id, "secondary", e.target.value)
                    }
                    style={{
                      width: 40,
                      height: 32,
                      padding: 0,
                      border: "none",
                      background: "none",
                    }}
                  />
                  <input
                    value={org.theme.secondary}
                    onChange={(e) =>
                      handleColorChange(org.id, "secondary", e.target.value)
                    }
                    style={{ width: 110, padding: "6px 8px" }}
                  />
                </label>

                {/* live preview */}
                <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: org.theme.primary,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <span
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: org.theme.secondary,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => handleSave(org)}
                disabled={savingId === org.id}
                style={{ padding: "8px 12px" }}
              >
                {savingId === org.id ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        ))}

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </section>
    </main>
  );
}
