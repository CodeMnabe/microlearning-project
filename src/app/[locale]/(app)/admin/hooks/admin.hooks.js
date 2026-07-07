import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";

import { DEFAULT_THEME } from "../lib/admin.constants";

import {
  applyThemeCssVars,
  buildThemePayload,
  isValidHexColor,
  normalizeOrganizationTheme,
  updateOrganizationThemeColor,
} from "../lib/admin.helpers";

/**
 * Hook principal da página Admin.
 *
 * Gere:
 * - utilizador autenticado;
 * - organizações do owner atual;
 * - criação de organizações;
 * - edição local de temas;
 * - gravação de temas na Supabase;
 * - mensagens e estados de loading/saving.
 */
export function useAdminOrganizations({
  translation,
  showAlert,
  stopLoading,
}) {
  const supabase = useMemo(() => createClient(), []);
  const showAlertRef = useRef(showAlert);

  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  useEffect(() => {
    stopLoading();
  }, [stopLoading]);

  useEffect(() => {
    let mounted = true;

    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(user || null);
    }

    loadCurrentUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const loadOrganizations = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("organization")
        .select("id, name, theme, logo_url")
        .eq("owner_user_id", user.id)
        .order("id", { ascending: true });

      if (error) {
        throw error;
      }

      setOrgs((data || []).map(normalizeOrganizationTheme));
    } catch (err) {
      console.error("[Admin] load organizations error:", err);

      setMsg(translation("messages.loadOrganizationsError"));

      await showAlertRef.current({
        title: translation("alerts.loadOrganizationsError.title"),
        message: translation("alerts.loadOrganizationsError.message"),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, translation, user]);

  useEffect(() => {
    if (!user) return;

    loadOrganizations();
  }, [user, loadOrganizations]);

  const handleColorChange = useCallback((orgId, key, value) => {
    setOrgs((prev) => updateOrganizationThemeColor(prev, orgId, key, value));
  }, []);

  const handleSave = useCallback(
    async (org) => {
      if (
        !isValidHexColor(org.theme.primary) ||
        !isValidHexColor(org.theme.secondary)
      ) {
        await showAlertRef.current({
          title: translation("alerts.invalidColor.title"),
          message: translation("alerts.invalidColor.message"),
          tone: "warning",
        });

        return;
      }

      setSavingId(org.id);
      setMsg(null);

      try {
        const payload = buildThemePayload(org.theme);

        const { data, error } = await supabase
          .from("organization")
          .update(payload)
          .eq("id", org.id)
          .select("id, name, theme")
          .single();

        if (error) {
          throw error;
        }

        setOrgs((prev) =>
          prev.map((item) =>
            item.id === org.id ? { ...item, theme: data.theme } : item,
          ),
        );

        applyThemeCssVars(data.theme);

        setMsg(translation("messages.themeSaved", { name: org.name }));

        await showAlertRef.current({
          title: translation("alerts.themeSaved.title"),
          message: translation("alerts.themeSaved.message", {
            name: org.name,
          }),
          tone: "success",
        });
      } catch (err) {
        console.error("[Admin] save theme error:", err);

        setMsg(translation("messages.themeSaveError"));

        await showAlertRef.current({
          title: translation("alerts.themeSaveError.title"),
          message: translation("alerts.themeSaveError.message"),
          tone: "danger",
        });
      } finally {
        setSavingId(null);
      }
    },
    [supabase, translation],
  );

  const handleCreate = useCallback(
    async (event) => {
      event.preventDefault();

      if (!name.trim()) {
        setMsg(translation("newOrganization.required"));

        await showAlertRef.current({
          title: translation("alerts.organizationNameRequired.title"),
          message: translation("alerts.organizationNameRequired.message"),
          tone: "warning",
        });

        return;
      }

      if (!user?.id) {
        await showAlertRef.current({
          title: translation("alerts.notAuthenticated.title"),
          message: translation("alerts.notAuthenticated.message"),
          tone: "warning",
        });

        return;
      }

      setCreating(true);
      setMsg(null);

      try {
        const { data, error } = await supabase
          .from("organization")
          .insert([
            {
              name: name.trim(),
              owner_user_id: user.id,
              theme: DEFAULT_THEME,
            },
          ])
          .select("id, name, theme")
          .single();

        if (error) {
          throw error;
        }

        setOrgs((prev) => [...prev, normalizeOrganizationTheme(data)]);
        setName("");

        setMsg(
          translation("messages.organizationCreated", {
            id: data.id,
            name: data.name,
          }),
        );

        await showAlertRef.current({
          title: translation("alerts.organizationCreated.title"),
          message: translation("alerts.organizationCreated.message", {
            name: data.name,
          }),
          tone: "success",
        });
      } catch (err) {
        console.error("[Admin] create organization error:", err);

        setMsg(translation("messages.organizationCreateError"));

        await showAlertRef.current({
          title: translation("alerts.organizationCreateError.title"),
          message: translation("alerts.organizationCreateError.message"),
          tone: "danger",
        });
      } finally {
        setCreating(false);
      }
    },
    [name, supabase, translation, user?.id],
  );

  return {
    orgs,
    loading,
    savingId,
    msg,

    name,
    setName,
    creating,

    handleColorChange,
    handleSave,
    handleCreate,
  };
}