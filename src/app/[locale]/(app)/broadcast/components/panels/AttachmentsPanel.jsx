import styles from "../../broadcast.module.css";

export default function AttachmentsPanel({
  channel,
  fileInputRef,
  thumbInputRef,
  handlePickFiles,
  handlePickThumbnail,
  imageFiles,
  videoFiles,
  otherFiles,
  files,
  removeFile,
  openThumbnailPicker,
  removeThumbnail,
  translation,
}) {
  return (
    <div className={styles.toolPanelCard}>
      <div className={styles.panelTitle}>
        {translation("Broadcast.attachments")} (
        {channel === "whatsapp" ? "WhatsApp" : "Teams"})
      </div>

      <div className={styles.imagesRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          onChange={handlePickFiles}
        />
      </div>

      <input
        ref={thumbInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePickThumbnail}
      />

      <div className={styles.filesStack}>
        {imageFiles.length > 0 && (
          <div>
            <div className={styles.label}>
              {translation("Broadcast.images")}
            </div>

            <div className={styles.thumbStrip}>
              {imageFiles.map((f) => (
                <div key={f.url} className={styles.thumbWrap}>
                  <img
                    src={f.url}
                    alt={f.name || "upload"}
                    width={110}
                    height={110}
                    className={styles.imageThumb}
                  />

                  <button
                    onClick={() => removeFile(f.url)}
                    className={styles.thumbClose}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {videoFiles.length > 0 && (
          <div>
            <div className={styles.label}>
              {translation("Broadcast.videos")}
            </div>

            <div className={styles.fileList}>
              {videoFiles.map((f) => (
                <div key={f.url} className={styles.fileItem}>
                  <div className={styles.fileMeta}>
                    <div className={styles.fileName}>{f.name || "video"}</div>
                    <div className={styles.fileType}>{f.contentType}</div>
                  </div>

                  <div className={styles.fileActions}>
                    <button
                      type="button"
                      onClick={() => openThumbnailPicker(f.url)}
                      className={styles.kbdBtn}
                    >
                      {translation("Broadcast.thumbnail")}
                    </button>

                    {f.thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => removeThumbnail(f.url)}
                        className={styles.kbdBtn}
                      >
                        {translation("Broadcast.removeThumbnail")}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFile(f.url)}
                      className={styles.kbdBtn}
                    >
                      {translation("Broadcast.remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherFiles.length > 0 && (
          <div>
            <div className={styles.label}>{translation("Broadcast.files")}</div>

            <div className={styles.fileList}>
              {otherFiles.map((f) => (
                <div key={f.url} className={styles.fileItem}>
                  <div className={styles.fileMeta}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.name || "file"}
                    </a>

                    <div className={styles.fileType}>{f.contentType}</div>
                  </div>

                  <div className={styles.fileActions}>
                    <button
                      type="button"
                      onClick={() => removeFile(f.url)}
                      className={styles.kbdBtn}
                    >
                      {translation("Broadcast.remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length === 0 && (
          <div className={styles.emptyMini}>Sem anexos adicionados.</div>
        )}
      </div>
    </div>
  );
}
