import styles from "../assistants.module.css";

import { hasVectorStoreFormData } from "../lib/assistants.helpers";

export default function AssistantVectorStoreCard({
  selected,
  vectorStore,
  vsName,
  vsFiles,
  translation,
  onVectorStoreNameChange,
  onVectorStoreFilesChange,
  onCreateVectorStore,
  onDeleteVectorStore,
}) {
  const canCreateVectorStore = hasVectorStoreFormData(vsName, vsFiles);

  return (
    <section className={`${styles.card} ${styles.paperCard}`}>
      {!selected.vectorStoreId ? (
        <>
          <h3 className={styles.cardSubtitle}>
            {translation("Assistants.vector.create")}
          </h3>

          <label className={styles.label}>
            {translation("Assistants.vector.collectionName")}
          </label>

          <input
            className={styles.input}
            value={vsName}
            onChange={(event) =>
              onVectorStoreNameChange(event.target.value)
            }
            placeholder={`${translation(
              "Assistants.vector.collectionNamePlaceholder",
            )} ${selected.name}`}
          />

          <label className={styles.label}>
            {translation("Assistants.vector.chooseFiles")}
          </label>

          <input
            className={styles.input}
            type="file"
            multiple
            onChange={(event) =>
              onVectorStoreFilesChange(event.target.files)
            }
          />

          <div className={styles.rowEnd}>
            <button
              className={styles.ctaPrimary}
              onClick={onCreateVectorStore}
              disabled={!canCreateVectorStore}
            >
              {translation("Assistants.vector.createAndAttach")}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className={styles.cardSubtitle}>
            {translation("Assistants.vector.docCollection")}
          </h3>

          <div className={styles.metaGrid}>
            {vectorStore && (
              <>
                <div>
                  <span className={styles.metaLabel}>
                    {translation("Assistants.vector.collectionTitle")}
                  </span>

                  <span>{vectorStore.storeName}</span>
                </div>

                <div>
                  <span className={styles.metaLabel}>
                    {translation("Assistants.vector.quantity")}
                  </span>

                  <span>{vectorStore.files?.length || 0}</span>
                </div>
              </>
            )}
          </div>

          {vectorStore?.files?.length ? (
            <div className={styles.filesListWrapper}>
              <span className={styles.metaLabel}>
                {translation("Assistants.vector.filenames")}
              </span>

              <ul className={styles.filesList}>
                {vectorStore.files.map((file) => (
                  <li key={file.id}>{file.name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={styles.rowEnd}>
            <button className={styles.dangerBtn} onClick={onDeleteVectorStore}>
              {translation("Common.delete")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}