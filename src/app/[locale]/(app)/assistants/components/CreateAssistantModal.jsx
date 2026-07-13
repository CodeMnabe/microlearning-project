"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import PillSelect from "@/app/components/PillSelect/PillSelect";
import Slider from "@/app/components/Slider/Slider";

import styles from "../assistants.module.css";

import { ASSISTANT_MODEL_OPTIONS } from "../lib/assistants.constants";

export default function CreateAssistantModal({
  isOpen,
  form,
  isCreating,
  translation,
  onClose,
  onChange,
  onSubmit,
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("modal-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const name = form?.name ?? "";
  const description = form?.description ?? "";
  const instructions = form?.instructions ?? "";
  const model = form?.model ?? ASSISTANT_MODEL_OPTIONS[0].value;
  const topP = Number(form?.top_p ?? 0.5);
  const temperature = Number(form?.temperature ?? 1);

  return createPortal(
    <div
      className={styles.modalOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {translation("CreateAssistant.title")}
        </h2>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>{translation("CreateAssistant.name")}</label>

            <input
              value={name}
              onChange={(event) => onChange("name", event.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("CreateAssistant.description")}</label>

            <input
              value={description}
              onChange={(event) =>
                onChange("description", event.target.value)
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("CreateAssistant.instructions")}</label>

            <textarea
              value={instructions}
              onChange={(event) =>
                onChange("instructions", event.target.value)
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("CreateAssistant.model")}</label>

            <PillSelect
              options={ASSISTANT_MODEL_OPTIONS}
              value={model}
              onChange={(value) => onChange("model", value)}
              placeholder={translation("CreateAssistant.modelPlaceholder")}
              fullWidth
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{translation("CreateAssistant.creativity")}</label>

            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>{topP.toFixed(2)}</span>

              <Slider
                min={0}
                max={1}
                step={0.01}
                value={topP}
                onChange={(event) =>
                  onChange("top_p", parseFloat(event.target.value))
                }
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>{translation("CreateAssistant.variety")}</label>

            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                {temperature.toFixed(2)}
              </span>

              <Slider
                min={0}
                max={2}
                step={0.01}
                value={temperature}
                onChange={(event) =>
                  onChange("temperature", parseFloat(event.target.value))
                }
              />
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating
                ? translation("CreateAssistant.creating")
                : translation("CreateAssistant.create")}
            </button>

            <button type="button" onClick={onClose} disabled={isCreating}>
              {translation("Common.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}