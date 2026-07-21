import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseCsvFile,
  parseExcelFile,
} from "../../app/[locale]/(app)/users/ImportUsersModal/parseImportFile";
import { IMPORT_LIMITS } from "../../app/[locale]/(app)/users/ImportUsersModal/importLimits";

describe("Import Users - Limits and Security", () => {
  describe("CSV Parsing and Limits", () => {
    it("should reject file exceeding MAX_FILE_BYTES (limit - 1, limit, limit + 1)", async () => {
      // Limit
      let file = new File(["Name\nTest"], "test.csv");
      Object.defineProperty(file, "size", {
        value: IMPORT_LIMITS.MAX_FILE_BYTES,
      });
      await expect(parseCsvFile(file)).resolves.toHaveLength(1);

      // Limit - 1
      file = new File(["Name\nTest"], "test.csv");
      Object.defineProperty(file, "size", {
        value: IMPORT_LIMITS.MAX_FILE_BYTES - 1,
      });
      await expect(parseCsvFile(file)).resolves.toHaveLength(1);

      // Limit + 1
      file = new File(["Name\nTest"], "test.csv");
      Object.defineProperty(file, "size", {
        value: IMPORT_LIMITS.MAX_FILE_BYTES + 1,
      });
      await expect(parseCsvFile(file)).rejects.toMatchObject({
        code: "FILE_TOO_LARGE",
      });
    });

    it("should reject empty file", async () => {
      const emptyFile = new File([""], "test.csv");
      await expect(parseCsvFile(emptyFile)).rejects.toMatchObject({
        code: "EMPTY_FILE",
      });
    });

    it("should reject file with exactly MAX_ROWS + 1 rows", async () => {
      const limit = IMPORT_LIMITS.MAX_ROWS;
      const headers = "Name,Email\n";
      const rows = Array(limit + 1)
        .fill("Test,test@example.com")
        .join("\n");
      const file = new File([headers + rows], "test.csv");
      await expect(parseCsvFile(file)).rejects.toMatchObject({
        code: "TOO_MANY_ROWS",
      });
    });

    it("should accept file with exactly MAX_ROWS rows", async () => {
      const limit = IMPORT_LIMITS.MAX_ROWS;
      const headers = "Name,Email\n";
      const rows = Array(limit).fill("Test,test@example.com").join("\n");
      const file = new File([headers + rows], "test.csv");
      const res = await parseCsvFile(file);
      expect(res).toHaveLength(limit);
    });

    it("should reject file with exactly MAX_COLS + 1 columns", async () => {
      const limit = IMPORT_LIMITS.MAX_COLS;
      const headers = Array(limit + 1)
        .fill("Col")
        .map((c, i) => `${c}${i}`)
        .join(",");
      const file = new File(
        [
          headers +
            "\n" +
            Array(limit + 1)
              .fill("val")
              .join(","),
        ],
        "test.csv",
      );
      await expect(parseCsvFile(file)).rejects.toMatchObject({
        code: "TOO_MANY_COLUMNS",
      });
    });

    it("should reject prototype pollution headers", async () => {
      const file1 = new File(
        ["__proto__,Email\nTest,test@example.com"],
        "test.csv",
      );
      await expect(parseCsvFile(file1)).rejects.toMatchObject({
        code: "FORBIDDEN_HEADER",
      });

      const file2 = new File(
        [" __PROTO__ ,Email\nTest,test@example.com"],
        "test.csv",
      );
      await expect(parseCsvFile(file2)).rejects.toMatchObject({
        code: "FORBIDDEN_HEADER",
      });

      const file3 = new File(
        [" prototype ,Email\nTest,test@example.com"],
        "test.csv",
      );
      await expect(parseCsvFile(file3)).rejects.toMatchObject({
        code: "FORBIDDEN_HEADER",
      });

      const file4 = new File(
        ["Constructor,Email\nTest,test@example.com"],
        "test.csv",
      );
      await expect(parseCsvFile(file4)).rejects.toMatchObject({
        code: "FORBIDDEN_HEADER",
      });
    });

    it("should reject cell value exceeding max chars", async () => {
      const max = IMPORT_LIMITS.MAX_CELL_CHARS;
      // limit - 1
      const str1 = "a".repeat(max - 1);
      let file = new File(
        [`Name,Email\n"${str1}",test@example.com`],
        "test.csv",
      );
      await expect(parseCsvFile(file)).resolves.toHaveLength(1);

      // limit
      const str2 = "a".repeat(max);
      file = new File([`Name,Email\n"${str2}",test@example.com`], "test.csv");
      await expect(parseCsvFile(file)).resolves.toHaveLength(1);

      // limit + 1
      const hugeString = "a".repeat(max + 1);
      file = new File(
        [`Name,Email\n"${hugeString}",test@example.com`],
        "test.csv",
      );
      await expect(parseCsvFile(file)).rejects.toMatchObject({
        code: "CELL_TOO_LARGE",
      });
    });
  });

  describe("Excel File Validation and Worker Lifecycle", () => {
    let originalWorker;
    let mockWorkerInstance;

    beforeEach(() => {
      originalWorker = global.Worker;
      global.Worker = vi.fn().mockImplementation(function () {
        this.postMessage = vi.fn();
        this.terminate = vi.fn();
        mockWorkerInstance = this;
      });
      vi.useFakeTimers();
    });

    afterEach(() => {
      global.Worker = originalWorker;
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("should reject empty file size", async () => {
      const file = {
        size: 0,
        name: "test.xlsx",
        type: "application/zip",
        arrayBuffer: async () => new ArrayBuffer(0),
      };
      await expect(parseExcelFile(file).promise).rejects.toMatchObject({
        code: "EMPTY_FILE",
      });
    });

    it("should reject unsupported extensions (.xls, .xlsm, .xlsb, .ods)", async () => {
      const exts = [".xls", ".xlsm", ".xlsb", ".ods"];
      for (const ext of exts) {
        const file = {
          size: 100,
          name: `test${ext}`,
          arrayBuffer: async () => new ArrayBuffer(100),
        };
        await expect(parseExcelFile(file).promise).rejects.toMatchObject({
          code: "UNSUPPORTED_FORMAT",
        });
      }
    });

    it("should accept empty MIME if extension and content are valid", async () => {
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]).buffer;
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "",
        arrayBuffer: async () => buffer,
      };
      const { promise } = parseExcelFile(file);
      await Promise.resolve(); // flush microtasks for arrayBuffer
      expect(mockWorkerInstance.postMessage).toHaveBeenCalled();
    });

    it("should reject invalid MIME type", async () => {
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "text/plain",
        arrayBuffer: async () => new ArrayBuffer(10),
      };
      await expect(parseExcelFile(file).promise).rejects.toMatchObject({
        code: "INVALID_MIME_TYPE",
      });
    });

    it("should verify ZIP PK signature before Worker", async () => {
      const invalidBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "application/zip",
        arrayBuffer: async () => invalidBuffer,
      };
      await expect(parseExcelFile(file).promise).rejects.toMatchObject({
        code: "INVALID_FILE_SIGNATURE",
      });
      expect(global.Worker).toHaveBeenCalled();
      expect(mockWorkerInstance.postMessage).not.toHaveBeenCalled();
    });

    it("should terminate worker on success", async () => {
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "application/zip",
        arrayBuffer: async () => buffer,
      };
      const { promise } = parseExcelFile(file);
      await Promise.resolve();

      mockWorkerInstance.onmessage({ data: { ok: true, data: [] } });
      const result = await promise;
      expect(result).toEqual([]);
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it("should terminate worker on structure error code", async () => {
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "application/zip",
        arrayBuffer: async () => buffer,
      };
      const { promise } = parseExcelFile(file);
      await Promise.resolve();

      mockWorkerInstance.onmessage({
        data: { ok: false, code: "TOO_MANY_WORKSHEETS" },
      });
      await expect(promise).rejects.toMatchObject({
        code: "TOO_MANY_WORKSHEETS",
      });
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it("should ignore late messages after cancellation", async () => {
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "application/zip",
        arrayBuffer: async () => buffer,
      };
      const { promise, cancel } = parseExcelFile(file);
      await Promise.resolve();

      cancel();
      await expect(promise).rejects.toMatchObject({
        code: "PARSING_CANCELLED",
      });

      // Send late message, should not throw or change state
      mockWorkerInstance.onmessage({
        data: { ok: true, data: [{ name: "Late" }] },
      });
    });

    it("should terminate worker on timeout", async () => {
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
      const file = {
        size: 100,
        name: "test.xlsx",
        type: "application/zip",
        arrayBuffer: async () => buffer,
      };
      const { promise } = parseExcelFile(file);
      await Promise.resolve();

      vi.advanceTimersByTime(IMPORT_LIMITS.WORKER_TIMEOUT_MS + 100);
      await expect(promise).rejects.toMatchObject({ code: "WORKER_TIMEOUT" });
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });
  });
});
