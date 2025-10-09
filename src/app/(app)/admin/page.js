"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import styles from "./admin.module.css";
import ThemePreview from "./ThemePreview/ThemePreview";

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
  }, [supabase]);

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
  }, [user, supabase]);

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
    <main className={styles.pageWrapper}>
      <h1 className={styles.header}>Admin</h1>

      <section className={styles.formContainer}>
        <h2 className={styles.title}>Nova organização</h2>
        <form onSubmit={handleCreate} className={styles.form}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da organização…"
            required
            className={styles.input}
          />
          <button disabled={creating} className={styles.formButton}>
            {creating ? "A criar…" : "Criar"}
          </button>
        </form>
      </section>

      <section>
        <h2 className={styles.title}>Temas</h2>
        {loading && <p>A carregar…</p>}
        {!loading && orgs.length === 0 && <p>Sem organizações.</p>}

        {orgs.map((org) => (
          <div key={org.id} className={styles.changeThemesWrapper}>
            <div>
              <div className={styles.orgName}>
                #{org.id} — {org.name}
              </div>

              <div className={styles.themesQuery}>
                <label className={styles.colorPicker}>
                  <span style={{ width: 80 }}>Primary</span>
                  <input
                    type="color"
                    value={org.theme.primary}
                    onChange={(e) =>
                      handleColorChange(org.id, "primary", e.target.value)
                    }
                    className={styles.colorInput}
                  />
                  <input
                    value={org.theme.primary}
                    onChange={(e) =>
                      handleColorChange(org.id, "primary", e.target.value)
                    }
                    className={styles.colorTextInput}
                  />
                </label>

                <label className={styles.colorPicker}>
                  <span style={{ width: 80 }}>Secondary</span>
                  <input
                    type="color"
                    value={org.theme.secondary}
                    onChange={(e) =>
                      handleColorChange(org.id, "secondary", e.target.value)
                    }
                    className={styles.colorInput}
                  />
                  <input
                    value={org.theme.secondary}
                    onChange={(e) =>
                      handleColorChange(org.id, "secondary", e.target.value)
                    }
                    className={styles.colorTextInput}
                  />
                </label>
                <button
                  onClick={() => handleSave(org)}
                  disabled={savingId === org.id}
                  className={styles.saveButton}
                >
                  {savingId === org.id ? "A guardar…" : "Guardar"}
                </button>
              </div>
            </div>
            <div className={styles.livePreviewWrapper}>
              <ThemePreview
                theme={org.theme}
                orgName={org.name}
                logo_url={org.logo_url}
              />
            </div>
          </div>
        ))}

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </section>
    </main>
  );
}
