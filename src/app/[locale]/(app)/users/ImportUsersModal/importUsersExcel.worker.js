import readXlsxFile from "read-excel-file/web-worker";
import { IMPORT_LIMITS } from "./importLimits";

function rv(buffer, options) {
  return readXlsxFile(buffer, options);
}

self.onmessage = async (e) => {
  try {
    let { arrayBuffer: t } = e.data;
    if (!t || t.byteLength > IMPORT_LIMITS.MAX_FILE_BYTES) {
      throw {
        code: "FILE_TOO_LARGE",
        details: { max: IMPORT_LIMITS.MAX_FILE_BYTES },
      };
    }
    let sheets = await rv(t, { getSheets: true }).catch(() => null);
    if (!sheets || !sheets.length) {
      throw { code: "NO_WORKSHEETS" };
    }
    if (sheets.length > IMPORT_LIMITS.MAX_WORKSHEETS) {
      throw {
        code: "TOO_MANY_WORKSHEETS",
        details: { max: IMPORT_LIMITS.MAX_WORKSHEETS },
      };
    }

    // MAX_WORKSHEETS_PROCESSED is implicitly 1 by picking the first match or index 0.
    let sheet =
      sheets.find((s) => "users" === s.name.toLowerCase()) || sheets[0];

    let rows = await rv(t, { sheet: sheet.name });
    if (!rows || rows.length === 0) {
      throw { code: "EMPTY_WORKSHEET" };
    }

    if (rows.length - 1 > IMPORT_LIMITS.MAX_ROWS) {
      throw { code: "TOO_MANY_ROWS", details: { max: IMPORT_LIMITS.MAX_ROWS } };
    }

    let headers = rows[0];
    if (!headers || headers.length > IMPORT_LIMITS.MAX_COLS) {
      throw {
        code: "TOO_MANY_COLUMNS",
        details: { max: IMPORT_LIMITS.MAX_COLS },
      };
    }

    let forbidden = ["__proto__", "prototype", "constructor"];
    let safeHeaders = headers.map((h) => {
      let trimmed = String(h || "").trim();
      if (forbidden.includes(trimmed.toLowerCase())) {
        throw { code: "FORBIDDEN_HEADER", details: { header: trimmed } };
      }
      return trimmed;
    });

    let result = [];
    let validRows = 0;

    for (let r = 1; r < rows.length; r++) {
      let row = rows[r];
      let obj = Object.create(null);
      let hasData = false;
      for (let n = 0; n < safeHeaders.length; n++) {
        let key = safeHeaders[n];
        if (!key) continue;
        let cell = row[n];
        if (cell != null) {
          if (String(cell).length > IMPORT_LIMITS.MAX_CELL_CHARS) {
            throw {
              code: "CELL_TOO_LARGE",
              details: {
                row: r + 1,
                col: n + 1,
                max: IMPORT_LIMITS.MAX_CELL_CHARS,
              },
            };
          }
          obj[key] = cell;
          hasData = true;
        }
      }
      if (hasData) {
        result.push(Object.assign({}, obj));
        validRows++;
      }
    }

    if (validRows === 0) {
      throw { code: "NO_VALID_ROWS" };
    }

    self.postMessage({ ok: true, data: result });
  } catch (err) {
    if (err && err.code) {
      self.postMessage({ ok: false, code: err.code, details: err.details });
    } else {
      self.postMessage({
        ok: false,
        code: "READ_FAILED",
        details: { message: err?.message || "Unknown error" },
      });
    }
  }
};
