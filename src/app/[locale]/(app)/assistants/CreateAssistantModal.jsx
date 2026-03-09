"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./assistants.module.css";
import { useTranslations } from "next-intl";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import Slider from "@/app/components/Slider/Slider";

export default function CreateAssistantModal({
  orgId,
  isOpen,
  onClose,
  onCreated,
}) {
  const translation = useTranslations();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("gpt-4.1");
  const modelOptions = [
    { value: "gpt-4.1", label: "gpt-4.1" },
    // { value: "gpt-5.2", label: "gpt-5.2" },
    // { value: "gpt-4o", label: "gpt-4o" },
  ];
  const [topP, setTopP] = useState(0.5);
  const [temperature, setTemperature] = useState(1.0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [isOpen, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch("/api/assistants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId, // or dynamic
        name: name,
        description: description,
        instructions: instructions,
        model: model,
        top_p: topP,
        temperature: temperature,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert("Error creating assistant: " + error.error);
      return;
    }

    // all good
    onCreated(); // let parent refresh the list
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {translation("CreateAssistant.title")}
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>
              {translation("CreateAssistant.name")}
              <span
                className={styles.infoIcon}
                data-tooltip={translation("CreateAssistant.nameHelp")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              {translation("CreateAssistant.description")}
              <span
                className={styles.infoIcon}
                data-tooltip={translation("CreateAssistant.descriptionHelp")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              {translation("CreateAssistant.instructions")}
              <span
                className={styles.infoIcon}
                data-tooltip={translation("CreateAssistant.instructionsHelp")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              {translation("CreateAssistant.model")}
              <span
                className={styles.infoIcon}
                data-tooltip={translation("CreateAssistant.modelHelp")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <PillSelect
              options={modelOptions}
              value={model}
              onChange={setModel}
              placeholder={translation("CreateAssistant.modelPlaceholder")}
              fullWidth
              className={styles.input} // keeps same width/spacing as your inputs
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              {translation("CreateAssistant.creativity")}
              <span
                className={styles.infoIcon}
                data-tooltip={translation("CreateAssistant.creativityHelp")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>{topP.toFixed(2)}</span>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>
              {translation("CreateAssistant.variety")}
              <span
                className={styles.infoIcon}
                data-tooltip={translation("CreateAssistant.varietyHelp")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
           10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
           0-8-3.59-8-8s3.59-8 8-8 8 3.59 8
           8-3.59 8-8 8zm-1-13h2v2h-2zm0
           4h2v6h-2z"
                  />
                </svg>
              </span>
            </label>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                {temperature.toFixed(2)}
              </span>
              <Slider
                min={0}
                max={2}
                step={0.01}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
          </div>
          <div className={styles.buttonGroup}>
            <button type="submit">
              {translation("CreateAssistant.create")}
            </button>
            <button type="button" onClick={onClose}>
              {translation("Common.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
