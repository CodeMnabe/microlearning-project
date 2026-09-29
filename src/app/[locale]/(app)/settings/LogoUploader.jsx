"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import {
  DEFAULT_LOGO_URL,
  getOrganizationFaviconUrl,
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
  variant = "logo",
}) {
  const isFavicon = variant === "favicon";
  const t = useTranslations(isFavicon ? "Settings.favicon" : "Settings.logo");
  const previewUrl = isFavicon
    ? getOrganizationFaviconUrl(logoUrl) || "/favicon.ico"
    : getOrganizationLogoUrl(logoUrl);
  const isDefault = isFavicon ? !getOrganizationFaviconUrl(logoUrl) : previewUrl === DEFAULT_LOGO_URL;
  const showAlert = useAlert();
  const [file, setFile] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setImageDimensions(null);
    if (!file) {
      setObjectUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    let image;
    if (isFavicon) {
      image = new Image();
      image.onload = () => setImageDimensions({
        file,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      image.src = nextUrl;
    }
    return () => {
      if (image) image.onload = null;
      URL.revokeObjectURL(nextUrl);
    };
  }, [file, isFavicon]);

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
      body.set(variant, file);

      const response = await fetch(`/api/organizations/${variant}`, {
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
      const response = await fetch(`/api/organizations/${variant}`, {
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
      <div className={isFavicon ? `${styles.logoPreviewFrame} ${styles.faviconPreviewFrame}` : styles.logoPreviewFrame}>
        <img
          src={objectUrl || previewUrl}
          alt={isFavicon ? t("title") : orgName}
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
        {isFavicon && file && imageDimensions?.file === file &&
          imageDimensions.width !== imageDimensions.height && (
            <p className={styles.helpText} role="status">
              {t("nonSquareWarning")}
            </p>
          )}

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
              isDisabled || isDefault
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
