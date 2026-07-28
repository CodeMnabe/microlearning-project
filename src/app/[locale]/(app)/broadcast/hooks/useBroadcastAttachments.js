"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  isImageContentType,
  isVideoContentType,
  uploadBroadcastFiles,
} from "../lib";
/**
 * Gere anexos do composer.
 *
 * Responsabilidades:
 * - fazer upload de ficheiros para o storage;
 * - separar ficheiros por tipo: imagens, vídeos e outros;
 * - expor URLs de imagem para payloads de envio;
 * - gerir thumbnails de vídeos;
 * - remover ficheiros e thumbnails.
 */

export function useBroadcastAttachments({
  supabase,
  composerFiles,
  setComposerFiles,
  showAlert,
  translation,
}) {
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const [thumbForVideoUrl, setThumbForVideoUrl] = useState(null);

  const imageFiles = useMemo(
    () => composerFiles.filter((file) => isImageContentType(file.contentType)),
    [composerFiles],
  );

  const videoFiles = useMemo(
    () => composerFiles.filter((file) => isVideoContentType(file.contentType)),
    [composerFiles],
  );

  const otherFiles = useMemo(
    () =>
      composerFiles.filter(
        (file) =>
          !isImageContentType(file.contentType) &&
          !isVideoContentType(file.contentType),
      ),
    [composerFiles],
  );

  const imageUrls = useMemo(
    () => imageFiles.map((file) => file.url),
    [imageFiles],
  );

  const attachmentsCount = composerFiles.length;

  const supabaseUpload = useCallback(
    async (pickedFiles) => {
      return uploadBroadcastFiles({
        supabase,
        files: pickedFiles,
      });
    },
    [supabase],
  );

  const removeFile = useCallback(
    (url) => {
      setComposerFiles((prev) => prev.filter((file) => file.url !== url));
    },
    [setComposerFiles],
  );

  const handlePickFiles = useCallback(
    async (event) => {
      const picked = Array.from(event.target.files || []);

      if (!picked.length) return;

      try {
        const uploaded = await supabaseUpload(picked);

        setComposerFiles((prev) => [...prev, ...uploaded]);
      } catch (err) {
        await showAlert({
          title: translation("Common.error"),
          message: err.message,
          tone: "danger",
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [setComposerFiles, showAlert, supabaseUpload, translation],
  );

  const openThumbnailPicker = useCallback((videoUrl) => {
    setThumbForVideoUrl(videoUrl);

    setTimeout(() => {
      thumbInputRef.current?.click?.();
    }, 0);
  }, []);

  const handlePickThumbnail = useCallback(
    async (event) => {
      const picked = Array.from(event.target.files || []);

      if (!picked.length || !thumbForVideoUrl) {
        if (thumbInputRef.current) {
          thumbInputRef.current.value = "";
        }

        return;
      }

      try {
        const uploaded = await supabaseUpload([picked[0]]);
        const thumb = uploaded[0];

        if (thumb?.url) {
          setComposerFiles((prev) =>
            prev.map((file) =>
              file.url === thumbForVideoUrl
                ? { ...file, thumbnailUrl: thumb.url }
                : file,
            ),
          );
        }
      } catch (err) {
        await showAlert({
          title: translation("Common.error"),
          message: err.message,
          tone: "danger",
        });
      } finally {
        setThumbForVideoUrl(null);

        if (thumbInputRef.current) {
          thumbInputRef.current.value = "";
        }
      }
    },
    [
      setComposerFiles,
      showAlert,
      supabaseUpload,
      thumbForVideoUrl,
      translation,
    ],
  );

  const removeThumbnail = useCallback(
    (videoUrl) => {
      setComposerFiles((prev) =>
        prev.map((file) =>
          file.url === videoUrl ? { ...file, thumbnailUrl: null } : file,
        ),
      );
    },
    [setComposerFiles],
  );

  return {
    fileInputRef,
    thumbInputRef,

    imageFiles,
    videoFiles,
    otherFiles,
    imageUrls,
    attachmentsCount,

    removeFile,
    handlePickFiles,
    openThumbnailPicker,
    handlePickThumbnail,
    removeThumbnail,
  };
}
