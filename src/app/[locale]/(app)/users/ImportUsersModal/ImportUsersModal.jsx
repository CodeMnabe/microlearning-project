"use client";

import { useMemo, useState, useEffect } from "react";
import Papa from "papaparse";
import styles from "./import.module.css";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import mapCsvRow from "./helpers";

const PREVIEW_LIMIT = 10;

export default function ImportUsersModal({
  isOpen,
  onClose,
  orgId,
  assistants = [],
  defaultPhoneCode = "+351",
  onImported,
}) {
  const [rows, setRows] = useState([]);
  const [assistantId, setAssistantId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  // Keep mounted while closing animation runs
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
    } else {
      setRows([]);
      setAssistantId("");
      setIsSubmitting(false);
      setSummary(null);
      setError("");
      setFileName("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!render) return;

    const onKey = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, isSubmitting, onClose]);

  const previewRows = useMemo(() => rows.slice(0, PREVIEW_LIMIT), [rows]);

  if (!render) return null;

  const stateClass = isOpen ? styles.open : styles.closing;

  function handleFileChange(file) {
    if (!file) return;

    setError("");
    setSummary(null);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const mapped = (results.data || [])
            .map((row) => mapCsvRow(row, defaultPhoneCode, assistantId || null))
            .filter((row) => row.name || row.email || row.teamsAadObjectId);

          if (!mapped.length) {
            setRows([]);
            setError("No valid rows were found in that CSV.");
            return;
          }

          setRows(mapped);

          if (results.errors?.length) {
            console.warn("CSV parse warnings:", results.errors);
          }
        } catch (err) {
          console.error(err);
          setRows([]);
          setError("There was a problem reading that CSV file.");
        }
      },
      error: (err) => {
        console.error(err);
        setRows([]);
        setError("There was a problem reading that CSV file.");
      },
    });
  }

  async function handleImport() {
    if (!rows.length || !orgId) return;

    setIsSubmitting(true);
    setSummary(null);
    setError("");

    try {
      const payload = rows.map((row) => ({
        ...row,
        assistantId: assistantId || row.assistantId || null,
      }));

      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          users: payload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }

      setSummary(data);
      await onImported?.();
    } catch (err) {
      console.error(err);
      setError("Import failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`${styles.modalOverlay} ${stateClass}`}
      onAnimationEnd={(e) => {
        if (!isOpen && e.target === e.currentTarget) setRender(false);
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className={`${styles.modalContent} ${stateClass} ${styles.modalContentWide}`}
        role="dialog"
        aria-modal="true"
      >
        <h3 className={styles.modalTitle}>Import users from CSV</h3>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="csvFile">CSV file</label>
            <input
              id="csvFile"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              disabled={isSubmitting}
            />
            {fileName ? (
              <div className={styles.helperText}>Selected file: {fileName}</div>
            ) : null}
          </div>

          <div className={styles.formGroup}>
            <label>Default Assistant</label>
            <PillSelect
              options={assistants.map((a) => ({ value: a.id, label: a.name }))}
              value={assistantId ?? ""}
              onChange={(value) => setAssistantId(value)}
              placeholder="Choose Assistant"
              fullWidth
              portalToBody
            />
            <div className={styles.helperText}>
              If you choose one here, it will be assigned to every imported
              user.
            </div>
          </div>

          <div className={styles.sectionDivider}>
            <span className={styles.sectionDividerLabel}>Import Preview</span>
          </div>

          {error ? <div className={styles.errorBox}>{error}</div> : null}

          {!rows.length && !error ? (
            <div className={styles.emptyState}>
              Upload a CSV file to preview the users before importing.
            </div>
          ) : null}

          {rows.length > 0 && (
            <div className={styles.previewCard}>
              <div className={styles.previewTop}>
                <div>
                  <div className={styles.previewTitle}>Preview</div>
                  <div className={styles.previewText}>
                    {rows.length} row{rows.length === 1 ? "" : "s"} ready to
                    import
                  </div>
                </div>
                <span className={styles.previewBadge}>
                  Showing {Math.min(rows.length, PREVIEW_LIMIT)} / {rows.length}
                </span>
              </div>

              <div className={styles.previewTable}>
                <div className={`${styles.previewRow} ${styles.previewHead}`}>
                  <div>Name</div>
                  <div>Email</div>
                  <div>Teams AAD Object ID</div>
                  <div>Phone</div>
                </div>

                {previewRows.map((row, index) => (
                  <div
                    key={`${row.email || row.teamsAadObjectId || row.name}-${index}`}
                    className={styles.previewRow}
                  >
                    <div>{row.name || "—"}</div>
                    <div>{row.email || "—"}</div>
                    <div>{row.teamsAadObjectId || "—"}</div>
                    <div>{row.phoneNumber || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary ? (
            <>
              <div className={styles.sectionDivider}>
                <span className={styles.sectionDividerLabel}>
                  Import Result
                </span>
              </div>

              <div className={styles.summaryBox}>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Created</span>
                    <strong>{summary.created}</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Skipped</span>
                    <strong>{summary.skipped}</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Failed</span>
                    <strong>{summary.failed}</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Received</span>
                    <strong>{summary.totalReceived}</strong>
                  </div>
                </div>

                {!!summary.skippedRows?.length && (
                  <div className={styles.resultList}>
                    <h5 className={styles.resultHeading}>Skipped rows</h5>
                    {summary.skippedRows.slice(0, 10).map((item, i) => (
                      <div key={i} className={styles.resultRow}>
                        Row {item.row}: {item.reason}
                        {item.name ? ` - ${item.name}` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {!!summary.failedRows?.length && (
                  <div className={styles.resultList}>
                    <h5 className={styles.resultHeading}>Failed rows</h5>
                    {summary.failedRows.slice(0, 10).map((item, i) => (
                      <div key={i} className={styles.resultRow}>
                        Row {item.row}: {item.reason}
                        {item.name ? ` - ${item.name}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Close
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={handleImport}
              disabled={!rows.length || isSubmitting}
            >
              {isSubmitting ? "Importing..." : "Import users"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
