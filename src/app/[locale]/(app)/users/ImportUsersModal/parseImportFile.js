import Papa from "papaparse";
import { IMPORT_LIMITS } from "./importLimits";

export function parseExcelFile(file) {
  let cancel = () => {};

  const promise = new Promise((resolve, reject) => {
    if (file.size > IMPORT_LIMITS.MAX_FILE_BYTES) {
      return reject({
        code: "FILE_TOO_LARGE",
        details: { max: IMPORT_LIMITS.MAX_FILE_BYTES },
      });
    }
    if (file.size === 0) {
      return reject({ code: "EMPTY_FILE" });
    }

    const name = (file.name || "").toLowerCase();
    if (
      name.endsWith(".xls") ||
      name.endsWith(".xlsm") ||
      name.endsWith(".xlsb") ||
      name.endsWith(".ods")
    ) {
      return reject({ code: "UNSUPPORTED_FORMAT" });
    }
    if (!name.endsWith(".xlsx")) {
      return reject({ code: "UNSUPPORTED_FORMAT" });
    }

    if (
      file.type &&
      file.type !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
      file.type !== "application/octet-stream" &&
      file.type !== "application/zip"
    ) {
      return reject({ code: "INVALID_MIME_TYPE" });
    }

    const worker = new Worker(
      new URL("./importUsersExcel.worker.js", import.meta.url),
      {
        type: "module",
      },
    );

    let isDone = false;

    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      worker.terminate();
    };

    worker.onmessage = (e) => {
      cleanup();
      if (e.data?.ok) {
        resolve(e.data.data);
      } else {
        reject({
          code: e.data?.code || "IMPORT_FAILED",
          details: e.data?.details || {},
        });
      }
    };

    worker.onerror = (e) => {
      cleanup();
      reject({ code: "READ_FAILED", details: { message: e.message } });
    };

    cancel = () => {
      if (isDone) return;
      cleanup();
      reject({ code: "PARSING_CANCELLED" });
    };

    const timeout = setTimeout(() => {
      if (isDone) return;
      cleanup();
      reject({
        code: "WORKER_TIMEOUT",
        details: { ms: IMPORT_LIMITS.WORKER_TIMEOUT_MS },
      });
    }, IMPORT_LIMITS.WORKER_TIMEOUT_MS);

    file
      .arrayBuffer()
      .then((buffer) => {
        if (buffer.byteLength < 4) {
          throw { code: "INVALID_FILE_SIGNATURE" };
        }
        const view = new Uint8Array(buffer, 0, 4);
        if (
          view[0] !== 0x50 ||
          view[1] !== 0x4b ||
          view[2] !== 0x03 ||
          view[3] !== 0x04
        ) {
          throw { code: "INVALID_FILE_SIGNATURE" };
        }
        worker.postMessage({ arrayBuffer: buffer }, [buffer]);
      })
      .catch((err) => {
        cleanup();
        if (err && err.code) {
          reject(err);
        } else {
          reject({
            code: "READ_FAILED",
            details: { message: err?.message || "Unknown error" },
          });
        }
      });
  });

  return { promise, cancel };
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > IMPORT_LIMITS.MAX_FILE_BYTES) {
      return reject({
        code: "FILE_TOO_LARGE",
        details: { max: IMPORT_LIMITS.MAX_FILE_BYTES },
      });
    }
    if (file.size === 0) {
      return reject({ code: "EMPTY_FILE" });
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      error: (err) =>
        reject({ code: "READ_FAILED", details: { message: err.message } }),
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parse warnings:", results.errors);
        }

        let rows = results.data;
        if (!rows || rows.length === 0) {
          return reject({ code: "EMPTY_WORKSHEET" });
        }
        if (rows.length > IMPORT_LIMITS.MAX_ROWS) {
          return reject({
            code: "TOO_MANY_ROWS",
            details: { max: IMPORT_LIMITS.MAX_ROWS },
          });
        }

        let headers = results.meta.fields;
        if (!headers || headers.length > IMPORT_LIMITS.MAX_COLS) {
          return reject({
            code: "TOO_MANY_COLUMNS",
            details: { max: IMPORT_LIMITS.MAX_COLS },
          });
        }

        let forbidden = ["__proto__", "prototype", "constructor"];
        for (let i = 0; i < headers.length; i++) {
          let trimmed = String(headers[i] || "").trim();
          if (forbidden.includes(trimmed.toLowerCase())) {
            return reject({
              code: "FORBIDDEN_HEADER",
              details: { header: trimmed },
            });
          }
        }

        let finalData = [];
        let validRows = 0;

        for (let r = 0; r < rows.length; r++) {
          let sourceRow = rows[r];
          let obj = Object.create(null);
          let hasData = false;

          for (let c = 0; c < headers.length; c++) {
            let key = String(headers[c] || "").trim();
            if (!key) continue;
            let val = sourceRow[headers[c]];
            if (val != null) {
              if (String(val).length > IMPORT_LIMITS.MAX_CELL_CHARS) {
                return reject({
                  code: "CELL_TOO_LARGE",
                  details: {
                    row: r + 1,
                    col: c + 1,
                    max: IMPORT_LIMITS.MAX_CELL_CHARS,
                  },
                });
              }
              obj[key] = val;
              hasData = true;
            }
          }
          if (hasData) {
            finalData.push(Object.assign({}, obj));
            validRows++;
          }
        }

        if (validRows === 0) {
          return reject({ code: "NO_VALID_ROWS" });
        }

        resolve(finalData);
      },
    });
  });
}
