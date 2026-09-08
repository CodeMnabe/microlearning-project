"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import phoneCountryCodes from "@/messages/phoneCountryCodes.json";
import { useAuth } from "@/app/AuthContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import {
  applyThemeVariables,
  DEFAULT_THEME,
  getSafeTheme,
  isValidHexColor,
  normalizeHexForColorInput,
} from "@/lib/helpers/theme.helpers";
import {
  DEFAULT_LOGO_URL,
  getOrganizationLogoUrl,
} from "@/lib/helpers/organizationLogo.helpers";
import LogoUploader from "./LogoUploader";
import ThemePreview from "./ThemePreview";
import styles from "./settings.module.css";

const EMPTY_FORM = {
  name: "",
  default_phone_country_code: "+351",
  theme: { ...DEFAULT_THEME },
  teams_tenant_id: "",
  waba_id: "",
  waba_namespace: "",
};

function toForm(item) {
  return {
    name: item?.name ?? "",
    default_phone_country_code:
      item?.default_phone_country_code ?? "+351",
    theme: getSafeTheme(item?.theme),
    teams_tenant_id: item?.teams_tenant_id ?? "",
    waba_id: item?.waba_id ?? "",
    waba_namespace: item?.waba_namespace ?? "",
  };
}

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const loadErrorMessage = t("loadError");
  const organizationMissingMessage = t("organizationMissing");
  const showAlert = useAlert();
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const orgId = org?.id;

  const [form, setForm] = useState(EMPTY_FORM);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState(null);

  const loadSettings = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/organizations/settings?orgId=${encodeURIComponent(orgId)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || loadErrorMessage);

      setForm(toForm(payload.item));
      setLogoUrl(getOrganizationLogoUrl(payload.item?.logo_url));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [loadErrorMessage, orgId]);

  useEffect(() => {
    if (authLoading || orgLoading) return;
    if (!orgId) {
      setLoading(false);
      setLoadError(organizationMissingMessage);
      return;
    }
    loadSettings();
  }, [
    authLoading,
    loadSettings,
    orgId,
    organizationMissingMessage,
    orgLoading,
  ]);

  useEffect(() => {
    if (!authLoading && !orgLoading && !loading) stopLoading();
  }, [authLoading, loading, orgLoading, stopLoading]);

  function setField(field, value) {
    setFeedback(null);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setThemeColor(field, value) {
    setFeedback(null);
    setForm((current) => ({
      ...current,
      theme: { ...current.theme, [field]: value },
    }));
  }

  async function save(event) {
    event.preventDefault();
    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({ tone: "error", message: t("validation.nameRequired") });
      return;
    }

    if (form.name.trim().length > 150) {
      setFeedback({ tone: "error", message: t("validation.nameTooLong") });
      return;
    }

    if (
      !isValidHexColor(form.theme.primary) ||
      !isValidHexColor(form.theme.secondary)
    ) {
      setFeedback({ tone: "error", message: t("validation.invalidColor") });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/organizations/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, ...form }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          response.status === 409 ? t("validation.teamsConflict") : payload.error;
        throw new Error(message || t("saveError"));
      }

      setForm(toForm(payload.item));
      setLogoUrl(getOrganizationLogoUrl(payload.item?.logo_url || logoUrl));
      applyThemeVariables(payload.item?.theme);
      window.dispatchEvent(new CustomEvent("organization:updated"));
      setFeedback({ tone: "success", message: t("saveSuccess") });
      void showAlert({
        title: t("saveSuccessTitle"),
        message: t("saveSuccess"),
        tone: "success",
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error.message });
      void showAlert({
        title: t("saveErrorTitle"),
        message: error.message,
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleLogoChange(item) {
    setLogoUrl(getOrganizationLogoUrl(item?.logo_url));
    window.dispatchEvent(new CustomEvent("organization:updated"));
  }

  if (authLoading || loading || orgLoading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.pageSkeleton} />
        <div className={styles.sectionSkeleton} />
        <div className={styles.sectionSkeleton} />
      </main>
    );
  }

  if (loadError) {
    return (
      <main className={styles.page}>
        <h1 className={styles.pageTitle}>{t("title")}</h1>
        <div className={styles.errorBox} role="alert">
          <p>{loadError}</p>
          {orgId && (
            <button className={styles.secondaryButton} onClick={loadSettings}>
              {t("retry")}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header>
        <h1 className={styles.pageTitle}>{t("title")}</h1>
        <p className={styles.pageDescription}>{t("description")}</p>
      </header>

      <form className={styles.form} onSubmit={save}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>{t("organization.title")}</h2>
            <p>{t("organization.description")}</p>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>{t("organization.name")}</span>
              <input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                maxLength={150}
                disabled={saving}
                required
              />
            </label>
            <label className={styles.field}>
              <span>{t("organization.defaultCountryCode")}</span>
              <select
                value={form.default_phone_country_code}
                onChange={(event) =>
                  setField("default_phone_country_code", event.target.value)
                }
                disabled={saving}
              >
                {phoneCountryCodes.map((country) => (
                  <option key={country.iso2} value={country.code}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
              <small>{t("organization.defaultCountryCodeHelp")}</small>
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>{t("appearance.title")}</h2>
            <p>{t("appearance.description")}</p>
          </div>

          <div className={styles.appearanceGrid}>
            <div className={styles.colorFields}>
              {["primary", "secondary"].map((color) => (
                <label className={styles.field} key={color}>
                  <span>{t(`appearance.${color}`)}</span>
                  <div className={styles.colorControl}>
                    <input
                      type="color"
                      value={normalizeHexForColorInput(
                        form.theme[color],
                        DEFAULT_THEME[color],
                      )}
                      onChange={(event) =>
                        setThemeColor(color, event.target.value)
                      }
                      disabled={saving}
                      aria-label={t(`appearance.${color}Picker`)}
                    />
                    <input
                      value={form.theme[color]}
                      onChange={(event) =>
                        setThemeColor(color, event.target.value)
                      }
                      disabled={saving}
                      aria-invalid={!isValidHexColor(form.theme[color])}
                      maxLength={7}
                      spellCheck={false}
                    />
                  </div>
                </label>
              ))}
            </div>
            <ThemePreview
              theme={form.theme}
              logoUrl={logoUrl}
              orgName={form.name}
            />
          </div>

          <div className={styles.logoBlock}>
            <h3>{t("logo.title")}</h3>
            <LogoUploader
              orgId={orgId}
              logoUrl={logoUrl}
              orgName={form.name}
              disabled={saving}
              onLogoChange={handleLogoChange}
            />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>{t("integrations.title")}</h2>
            <p>{t("integrations.description")}</p>
          </div>

          <div className={styles.integrationBlock}>
            <h3>{t("integrations.whatsappTitle")}</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>{t("integrations.wabaId")}</span>
                <input
                  value={form.waba_id}
                  onChange={(event) => setField("waba_id", event.target.value)}
                  disabled={saving}
                />
              </label>
              <label className={styles.field}>
                <span>
                  {t("integrations.namespace")}
                  <small className={styles.optionalLabel}>
                    · {t("integrations.namespaceOptional")}
                  </small>
                </span>
                <input
                  value={form.waba_namespace}
                  onChange={(event) =>
                    setField("waba_namespace", event.target.value)
                  }
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className={styles.integrationBlock}>
            <h3>{t("integrations.teamsTitle")}</h3>
            <label className={styles.field}>
              <span>{t("integrations.tenantId")}</span>
              <input
                value={form.teams_tenant_id}
                onChange={(event) =>
                  setField("teams_tenant_id", event.target.value)
                }
                disabled={saving}
              />
              <small>{t("integrations.tenantIdHelp")}</small>
            </label>
          </div>
        </section>

        <div className={styles.formFooter}>
          {feedback && (
            <p
              className={
                feedback.tone === "success"
                  ? styles.successMessage
                  : styles.errorMessage
              }
              role="status"
            >
              {feedback.message}
            </p>
          )}
          <button className={styles.primaryButton} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </main>
  );
}
