"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import styles from "./admin.module.css";
import ThemePreview from "./ThemePreview/ThemePreview";
import { useTranslations } from "next-intl";
import { useAlert } from "@/app/components/Alert/AlertProvider";


export default function AdminPage() {
 
  const translation = useTranslations("AdminPage");
  const  showAlert  = useAlert();
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

        setMsg(translation("messages.loadOrganizationsError"));

        await showAlert({
          title: translation("alerts.loadOrganizationsError.title"),
          message: translation("alerts.loadOrganizationsError.message"),
          tone: "danger",
        });
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
  }, [user, supabase, translation, showAlert]);

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

function isValidHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

  // 4) save through the server-side allowlisted endpoint
  async function handleSave(org) {
  if (
    !isValidHexColor(org.theme.primary) ||
    !isValidHexColor(org.theme.secondary)
  ) {
    await showAlert({
      title: translation("alerts.invalidColor.title"),
      message: translation("alerts.invalidColor.message"),
      tone: "warning",
    });

    return;
  }

  setSavingId(org.id);
  setMsg(null);

  try {
    const payload = {
      theme: { primary: org.theme.primary, secondary: org.theme.secondary },
    };

    const response = await fetch("/api/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id, ...payload }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to update organization");
    }

    const data = result.org;

    setOrgs((prev) =>
      prev.map((o) => (o.id === org.id ? { ...o, theme: data.theme } : o))
    );

    setCssVars(data.theme);

    setMsg(translation("messages.themeSaved", { name: org.name }));

    await showAlert({
      title: translation("alerts.themeSaved.title"),
      message: translation("alerts.themeSaved.message", {
        name: org.name,
      }),
      tone: "success",
    });
  } catch (err) {
    //console.error(err);

    setMsg(translation("messages.themeSaveError"));

    await showAlert({
      title: translation("alerts.themeSaveError.title"),
      message: translation("alerts.themeSaveError.message"),
      tone: "danger",
    });
  } finally {
    setSavingId(null);
  }
}

  return (
    <main className={styles.pageWrapper}>
      <h1 className={styles.header}>{translation("title")}</h1>

      <section>
        <h2 className={styles.title}>{translation("themes.title")}</h2>
        {loading && <p>{translation("themes.loading")}</p>}
       {!loading && orgs.length === 0 && (
          <p>{translation("themes.empty")}</p>
        )}
        {orgs.map((org) => (
          <div key={org.id} className={styles.changeThemesWrapper}>
            <div>
              <div className={styles.orgName}>
                #{org.id} — {org.name}
              </div>

              <div className={styles.themesQuery}>
                <label className={styles.colorPicker}>
                 <span style={{ width: 80 }}>{translation("themes.primary")}</span>
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
                  <span style={{ width: 80 }}>{translation("themes.secondary")}</span>
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
                 {savingId === org.id
                    ? translation("themes.saving")
                    : translation("themes.save")}
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
