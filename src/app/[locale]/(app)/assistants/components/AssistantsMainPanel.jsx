import styles from "../assistants.module.css";

import AssistantDetailsCard from "./AssistantDetailsCard";
import AssistantVectorStoreCard from "./AssistantVectorStoreCard";

export default function AssistantsMainPanel({
  selected,
  draft,
  isEditing,
  isSaving,
  vectorStore,
  vsName,
  vsFiles,
  translation,
  onFieldChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
  onVectorStoreNameChange,
  onVectorStoreFilesChange,
  onCreateVectorStore,
  onDeleteVectorStore,
}) {
  return (
    <section className={styles.mainCol}>
      {selected ? (
        <>
          <AssistantDetailsCard
            selected={selected}
            draft={draft}
            isEditing={isEditing}
            isSaving={isSaving}
            translation={translation}
            onFieldChange={onFieldChange}
            onSave={onSave}
            onCancel={onCancel}
            onEdit={onEdit}
            onDelete={onDelete}
          />

          <AssistantVectorStoreCard
            selected={selected}
            vectorStore={vectorStore}
            vsName={vsName}
            vsFiles={vsFiles}
            translation={translation}
            onVectorStoreNameChange={onVectorStoreNameChange}
            onVectorStoreFilesChange={onVectorStoreFilesChange}
            onCreateVectorStore={onCreateVectorStore}
            onDeleteVectorStore={onDeleteVectorStore}
          />
        </>
      ) : (
        <div className={styles.placeholderCard}>
          <p>{translation("Assistants.placeholder")}</p>
        </div>
      )}
    </section>
  );
}