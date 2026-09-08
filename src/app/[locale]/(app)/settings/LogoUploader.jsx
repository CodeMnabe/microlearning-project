"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import {
  DEFAULT_LOGO_URL,
  getOrganizationLogoUrl,
} from "@/lib/helpers/organizationLogo.helpers";
import styles from "./settings.module.css";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024;

export default function LogoUploader({
  orgId,
  logoUrl,
  orgName,
  disabled,
  onLogoChange,
}) {
  const t = useTranslations("Settings.logo");
  const showAlert = useAlert();
  const [file, setFile] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  function chooseFile(event) {
    const selected = event.target.files?.[0] ?? null;
    setFeedback(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.has(selected.type)) {
      setFile(null);
      event.target.value = "";
      setFeedback({ tone: "error", message: t("invalidType") });
      return;
    }

    if (selected.size > MAX_SIZE) {
      setFile(null);
      event.target.value = "";
      setFeedback({ tone: "error", message: t("tooLarge") });
      return;
    }

    setFile(selected);
  }

  async function upload() {
    if (!file || !orgId) return;

    setBusy(true);
    setFeedback(null);

    try {
      const body = new FormData();
      body.set("orgId", String(orgId));
      body.set("logo", file);

      const response = await fetch("/api/organizations/logo", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t("uploadError"));

      setFile(null);
      setFeedback({ tone: "success", message: t("uploadSuccess") });
      onLogoChange(payload.item);
      void showAlert({
        title: t("uploadSuccessTitle"),
        message: t("uploadSuccess"),
        tone: "success",
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error.message });
      void showAlert({
        title: t("uploadErrorTitle"),
        message: error.message,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!orgId) return;

    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/organizations/logo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t("resetError"));

      setFile(null);
      setFeedback({ tone: "success", message: t("resetSuccess") });
      onLogoChange(payload.item);
    } catch (error) {
      setFeedback({ tone: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const isDisabled = disabled || busy;

  return (
    <div className={styles.logoUploader}>
      <div className={styles.logoPreviewFrame}>
        <img
          src={objectUrl || getOrganizationLogoUrl(logoUrl)}
          alt={orgName}
        />
      </div>

      <div className={styles.logoControls}>
        <label className={styles.fileLabel}>
          <span>{t("choose")}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={chooseFile}
            disabled={isDisabled}
          />
        </label>
        <p className={styles.helpText}>{t("help")}</p>

        {file && <p className={styles.selectedFile}>{file.name}</p>}

        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={upload}
            disabled={isDisabled || !file}
          >
            {busy ? t("working") : t("upload")}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={reset}
            disabled={
              isDisabled || getOrganizationLogoUrl(logoUrl) === DEFAULT_LOGO_URL
            }
          >
            {t("reset")}
          </button>
        </div>

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
      </div>
    </div>
  );
}
