"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import styles from "../analytics.module.css";

export default function DescriptionInfo({ text }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!text) return null;

  return (
    <span className={styles.infoWrapper}>
      <button
        type="button"
        className={styles.infoButton}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        aria-label="Mostrar informação"
        aria-expanded={isOpen}
      >
        <Info size={14} />
      </button>

      {isOpen && <span className={styles.infoPopover}>{text}</span>}
    </span>
  );
}