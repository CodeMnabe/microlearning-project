import Slider from "@/app/components/Slider/Slider";

import styles from "../assistants.module.css";

import { ASSISTANT_MODEL_OPTIONS } from "../lib/assistants.constants";

import { readAssistantField } from "../lib/assistants.helpers";

export default function AssistantDetailsCard({
  selected,
  draft,
  isEditing,
  isSaving,
  translation,
  onFieldChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}) {
  function read(key, fallback = "") {
    return readAssistantField({
      isEditing,
      draft,
      selected,
      key,
      fallback,
    });
  }

  return (
    <section
      className={`${styles.card} ${styles.primaryCard} ${
        isEditing ? styles.editing : ""
      }`}
    >
      <div className={styles.cardTitleRow}>
        {isEditing ? (
          <input
            className={styles.inputTitle}
            value={read("name")}
            onChange={(event) => onFieldChange("name", event.target.value)}
          />
        ) : (
          <h2 className={styles.cardTitle}>{selected.name}</h2>
        )}
      </div>

      {isEditing ? (
        <>
          <input
            className={styles.inputSub}
            value={read("description")}
            maxLength={80}
            onChange={(event) =>
              onFieldChange("description", event.target.value)
            }
            placeholder={translation(
              "Assistants.details.descriptionPlaceholder",
            )}
          />

          <textarea
            className={styles.instructionsInput}
            value={read("instructions")}
            onChange={(event) =>
              onFieldChange("instructions", event.target.value)
            }
            placeholder={translation(
              "Assistants.details.instructionsPlaceholder",
            )}
          />
        </>
      ) : (
        <>
          <p className={styles.subdued}>{selected.description}</p>

          <div className={styles.instructionsPaper}>
            {selected.instructions}
          </div>
        </>
      )}

      <div className={styles.specBadge}>
        {translation("Assistants.details.specs")}
      </div>

      <div className={styles.specs}>
        <div className={styles.specRowGrid}>
          <span className={styles.specLabel}>
            {translation("Assistants.details.creativity")}
          </span>

          {isEditing ? (
            <div className={styles.sliderRowEditing}>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={read("top_p", 0)}
                onChange={(event) =>
                  onFieldChange("top_p", parseFloat(event.target.value))
                }
              />

              <span className={styles.sliderValueRight}>
                {(read("top_p", 0) || 0).toFixed(2)}
              </span>
            </div>
          ) : (
            <>
              <div className={styles.specTrack}>
                <div
                  className={styles.specFill}
                  style={{ width: `${(selected.top_p || 0) * 100}%` }}
                />
              </div>

              <span className={styles.specValue}>
                {(selected.top_p || 0).toFixed(1)}
              </span>
            </>
          )}
        </div>

        <div className={styles.specRowGrid}>
          <span className={styles.specLabel}>
            {translation("Assistants.details.variety")}
          </span>

          {isEditing ? (
            <div className={styles.sliderRowEditing}>
              <Slider
                min={0}
                max={2}
                step={0.01}
                value={read("temperature", 0)}
                onChange={(event) =>
                  onFieldChange("temperature", parseFloat(event.target.value))
                }
              />

              <span className={styles.sliderValueRight}>
                {(read("temperature", 0) || 0).toFixed(2)}
              </span>
            </div>
          ) : (
            <>
              <div className={styles.specTrack}>
                <div
                  className={styles.specFill}
                  style={{
                    width: `${
                      Math.min((selected.temperature || 0) / 2, 1) * 100
                    }%`,
                  }}
                />
              </div>

              <span className={styles.specValue}>
                {(selected.temperature || 0).toFixed(0)}
              </span>
            </>
          )}
        </div>

        <div className={styles.specRowGrid}>
          <span className={styles.specLabel}>
            {translation("Assistants.details.model")}
          </span>

          <div className={styles.specTrack} />

          {isEditing ? (
            <select
              className={styles.select}
              value={read("model", ASSISTANT_MODEL_OPTIONS[0].value)}
              onChange={(event) => onFieldChange("model", event.target.value)}
            >
              {ASSISTANT_MODEL_OPTIONS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={styles.specValueBold}>{selected.model}</span>
          )}
        </div>
      </div>

      <div className={styles.metaBar}>
        <div className={styles.metaGrid}>
          <div>
            <span className={styles.metaLabel}>ID</span>
            <span>{selected.open_ai_id}</span>
          </div>

          <div>
            <span className={styles.metaLabel}>
              {translation("Assistants.details.createdAt")}
            </span>

            <span>{new Date(selected.created_at).toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.actionsRow}>
          {isEditing ? (
            <>
              <button
                className={styles.ctaPrimary}
                disabled={isSaving}
                onClick={onSave}
              >
                {isSaving
                  ? translation("Assistants.details.saving")
                  : translation("Assistants.details.save")}
              </button>

              <button className={styles.ghostBtn} onClick={onCancel}>
                {translation("Common.cancel")}
              </button>
            </>
          ) : (
            <>
              <button className={styles.ghostBtn} onClick={onEdit}>
                {translation("Assistants.details.edit")}
              </button>

              <button className={styles.dangerBtn} onClick={onDelete}>
                {translation("Assistants.details.delete")}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}