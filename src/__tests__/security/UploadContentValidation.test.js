/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { validateMagicBytes } from "@/lib/security/magicBytes";



describe("Upload content validation", () => {
  it("validates correct PDF signature and EOF", () => {
    // Valid minimal PDF
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.alloc(100, 0),
      Buffer.from("%%EOF\n")
    ]);
    expect(validateMagicBytes(pdf, "pdf").valid).toBe(true);
  });

  it("rejects truncated PDF missing EOF", () => {
    const pdf = Buffer.from("%PDF-1.4\nsome content...");
    expect(validateMagicBytes(pdf, "pdf").valid).toBe(false);
  });

  it("rejects HTML masquerading as PDF", () => {
    const html = Buffer.from("<html lang='en'><body>Fake PDF</body></html>");
    expect(validateMagicBytes(html, "pdf").valid).toBe(false);
  });

  it("validates basic DOCX ZIP structure", () => {
    const { Buffer: NodeBuffer } = require("buffer");
    const docx = NodeBuffer.from("UEsDBBQAAAgIAAF09Vwn9SRQCAAAAAYAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLOpyM3RtwMAUEsDBBQAAAgIAAF09Vwn9SRQCAAAAAYAAAARAAAAd29yZC9kb2N1bWVudC54bWyzqcjN0bcDAFBLAQIUChQAAAgIAAF09Vwn9SRQCAAAAAYAAAATAAAAAAAAAAAAAACkgQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQKFAAACAgAAXT1XCf1JFAIAAAABgAAABEAAAAAAAAAAAAAAKSBOQAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAAHAAAAAAAA==", "base64");
    const res = validateMagicBytes(docx, "docx");
    expect(res.valid).toBe(true);
  });

  it("rejects DOCX without word/ structure", () => {
    const fakeZip = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      Buffer.from("some/random/file.txt")
    ]);
    expect(validateMagicBytes(fakeZip, "docx").valid).toBe(false);
  });

  it("validates PNG signature", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.alloc(10, 0)
    ]);
    expect(validateMagicBytes(png, "png").valid).toBe(true);
  });

  it("rejects plain text CSV with NUL bytes", () => {
    const csv = Buffer.concat([
      Buffer.from("name,age\njohn,20"),
      Buffer.from([0x00]),
      Buffer.from("\nmary,30")
    ]);
    expect(validateMagicBytes(csv, "csv").valid).toBe(false);
  });
});
