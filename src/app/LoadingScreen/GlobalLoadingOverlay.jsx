// GlobalLoadingOverlay.jsx
"use client";
import React from "react";
import { useGlobalLoader } from "./GlobalLoaderContext";
import styles from "./loadingScreen.module.css";

export default function GlobalLoadingOverlay() {
  const { showLoading, fadeOut } = useGlobalLoader();

  if (!showLoading) {
    // If loader is not supposed to be on the screen, don't render anything
    return null;
  }

  return (
    <div className={`${styles.loadingOverlay} ${fadeOut ? styles.hidden : ""}`}>
      <div className={styles.spinner}></div>
    </div>
  );
}
