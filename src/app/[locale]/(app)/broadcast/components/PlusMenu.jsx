"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Link2,
  Plus,
  Sparkles,
  User,
} from "lucide-react";

import styles from "../broadcast.module.css";
import { SuggestBar } from "./SuggestInPhone";

const VARIABLE_ICONS = {
  name: User,
  company: Building2,
  link: Link2,
};

/**
 * O "+" da barra inferior do telemóvel: junta imagens, vídeos, documentos,
 * links rastreados, sugestão de texto com IA e variáveis. É o mesmo em todos
 * os tipos de mensagem.
 */
export default function PlusMenu({
  onAddFile,
  onAddLink,
  onSuggestText,
  variables = [],
  onInsertToken,
  translation,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onDoc(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }

    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(action) {
    setOpen(false);
    action();
  }

  return (
    <div className={styles.plusWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.plusBtn}
        aria-label={translation("Broadcast.composer.add")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className={styles.plusMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.plusItem}
            onClick={() => pick(() => onAddFile("image/*"))}
          >
            <ImageIcon size={16} />
            <span>{translation("Broadcast.composer.addImage")}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={styles.plusItem}
            onClick={() => pick(() => onAddFile("video/*"))}
          >
            <FileVideo size={16} />
            <span>{translation("Broadcast.composer.addVideo")}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={styles.plusItem}
            onClick={() => pick(() => onAddFile("*/*"))}
          >
            <FileText size={16} />
            <span>{translation("Broadcast.composer.addDocument")}</span>
          </button>

          {onAddLink && (
            <button
              type="button"
              role="menuitem"
              className={styles.plusItem}
              onClick={() => pick(onAddLink)}
            >
              <Link2 size={16} />
              <span>{translation("Broadcast.composer.addLink")}</span>
            </button>
          )}

          {onSuggestText && (
            <button
              type="button"
              role="menuitem"
              className={styles.plusItem}
              onClick={() => pick(onSuggestText)}
            >
              <Sparkles size={16} />
              <span>{translation("Broadcast.suggest.title")}</span>
            </button>
          )}

          {variables.length > 0 && (
            <div className={styles.plusLabel}>
              {translation("Broadcast.composer.variables")}
            </div>
          )}

          {variables.map((v) => {
            const Icon = VARIABLE_ICONS[v.kind] || User;

            return (
              <button
                key={v.key}
                type="button"
                role="menuitem"
                className={styles.plusItem}
                onClick={() => pick(() => onInsertToken(v.key))}
              >
                <Icon size={16} />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Barra inferior do telemóvel com o "+" e a dica para escrever no balão.
 */
export function PlusMenuBar({ tools, translation }) {
  if (!tools) return null;

  if (tools.suggest?.active) {
    return <SuggestBar suggest={tools.suggest} translation={translation} />;
  }

  return (
    <>
      <PlusMenu
        onAddFile={tools.onAddFile}
        onAddLink={tools.onAddLink}
        onSuggestText={tools.suggest?.open}
        variables={tools.variables}
        onInsertToken={tools.onInsertToken}
        translation={translation}
      />
      <span className={styles.barHint}>
        {translation("Broadcast.composer.barHint")}
      </span>
    </>
  );
}
