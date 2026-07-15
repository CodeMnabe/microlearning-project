"use client";

import { useEffect, useRef } from "react";
import styles from "./interactiveAmbientBackground.module.css";

const POINTER_TRAVEL = {
  // Enough travel to be perceived through the blur, while remaining ambient.
  subtle: 48,
  medium: 64,
};

export default function InteractiveAmbientBackground({
  variant = "mist",
  intensity = "subtle",
  interactive = true,
  quality = "auto",
  className = "",
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const section = root?.parentElement;

    if (!root || !section || typeof window === "undefined") return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Pointer precision is the relevant capability here; do not gate desktop
    // interaction on the separate hover media feature.
    const finePointer = window.matchMedia("(pointer: fine)");
    const compactViewport = window.matchMedia("(max-width: 900px)");
    const lowConcurrency =
      typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency <= 4;
    const maxTravel = POINTER_TRAVEL[intensity] ?? POINTER_TRAVEL.subtle;

    let frameId = 0;
    let isPageVisible = !document.hidden;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const isActive = () => isPageVisible && !reducedMotion.matches;

    const updateQuality = () => {
      const resolvedQuality =
        quality === "auto"
          ? compactViewport.matches || !finePointer.matches || lowConcurrency
            ? "low"
            : "high"
          : quality;

      root.dataset.quality = resolvedQuality;
    };

    const updateMode = () => {
      const canInteract =
        interactive && finePointer.matches && !reducedMotion.matches;

      root.dataset.interactive = canInteract ? "true" : "false";
      root.dataset.active = isActive() ? "true" : "false";
      updateQuality();

      if (!isActive() && frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const renderPointer = () => {
      frameId = 0;
      if (!isActive()) return;

      // Fast enough to be noticed immediately, with enough lag to feel organic.
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      root.style.setProperty(
        "--ambient-a-x",
        `${(currentX * 0.68).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--ambient-a-y",
        `${(currentY * 0.44).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--ambient-b-x",
        `${(currentX * -0.48).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--ambient-b-y",
        `${(currentY * -0.36).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--ambient-c-x",
        `${(currentX * 0.36).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--ambient-c-y",
        `${(currentY * -0.28).toFixed(2)}px`,
      );
      root.style.setProperty("--pointer-a-x", `${currentX.toFixed(2)}px`);
      root.style.setProperty(
        "--pointer-a-y",
        `${(currentY * 0.82).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--pointer-b-x",
        `${(currentX * -0.56).toFixed(2)}px`,
      );
      root.style.setProperty(
        "--pointer-b-y",
        `${(currentY * -0.42).toFixed(2)}px`,
      );

      if (
        Math.abs(targetX - currentX) > 0.04 ||
        Math.abs(targetY - currentY) > 0.04
      ) {
        frameId = requestAnimationFrame(renderPointer);
      }
    };

    const requestPointerFrame = () => {
      if (!frameId && isActive()) {
        frameId = requestAnimationFrame(renderPointer);
      }
    };

    const resetPointer = () => {
      targetX = 0;
      targetY = 0;
      requestPointerFrame();
    };

    const handlePointerMove = (event) => {
      if (
        !interactive ||
        !finePointer.matches ||
        reducedMotion.matches ||
        !isActive()
      ) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const normalizedX = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      );
      const normalizedY = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
      );

      targetX = normalizedX * maxTravel;
      targetY = normalizedY * maxTravel * 0.72;
      requestPointerFrame();
    };

    const handleVisibility = () => {
      isPageVisible = !document.hidden;
      updateMode();
      if (isPageVisible) requestPointerFrame();
    };

    if (interactive) {
      section.addEventListener("pointermove", handlePointerMove, {
        passive: true,
        capture: true,
      });
      section.addEventListener("pointerleave", resetPointer);
    }
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", updateMode);
    finePointer.addEventListener("change", updateMode);
    compactViewport.addEventListener("change", updateMode);
    updateMode();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (interactive) {
        section.removeEventListener("pointermove", handlePointerMove, true);
        section.removeEventListener("pointerleave", resetPointer);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", updateMode);
      finePointer.removeEventListener("change", updateMode);
      compactViewport.removeEventListener("change", updateMode);
    };
  }, [intensity, interactive, quality]);

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      data-active="true"
      data-intensity={intensity}
      data-interactive={interactive ? "true" : "false"}
      data-quality={quality === "auto" ? "high" : quality}
      data-variant={variant}
      aria-hidden="true"
    >
      <span className={`${styles.blob} ${styles.blobA}`} />
      <span className={`${styles.blob} ${styles.blobB}`} />
      <span className={`${styles.blob} ${styles.blobC}`} />
      <span className={`${styles.pointerGlow} ${styles.pointerGlowA}`} />
      <span className={`${styles.pointerGlow} ${styles.pointerGlowB}`} />
      <span className={styles.contrast} />
    </div>
  );
}
