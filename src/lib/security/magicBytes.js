export function validateMagicBytes(buffer, expectedExtension) {
  if (!buffer || buffer.length === 0) return { valid: false, error: "File is empty" };

  const ext = expectedExtension.toLowerCase();

  // Helper to match bytes at offset
  const matches = (bytes, offset = 0) => {
    if (buffer.length < offset + bytes.length) return false;
    for (let i = 0; i < bytes.length; i++) {
      if (buffer[offset + i] !== bytes[i]) return false;
    }
    return true;
  };

  switch (ext) {
    case "pdf":
      // %PDF-
      if (!matches([0x25, 0x50, 0x44, 0x46, 0x2D])) return { valid: false, error: "Invalid PDF signature" };
      // Check for EOF marker %%EOF near the end (allow some trailing bytes/newlines)
      const eof = Buffer.from("%%EOF");
      let foundEof = false;
      const searchLimit = Math.max(0, buffer.length - 1024);
      for (let i = buffer.length - eof.length; i >= searchLimit; i--) {
        let match = true;
        for (let j = 0; j < eof.length; j++) {
          if (buffer[i + j] !== eof[j]) { match = false; break; }
        }
        if (match) { foundEof = true; break; }
      }
      if (!foundEof) return { valid: false, error: "PDF seems truncated (missing %%EOF)" };
      break;

    case "docx":
      // PK\x03\x04
      if (!matches([0x50, 0x4B, 0x03, 0x04])) return { valid: false, error: "Invalid DOCX (ZIP) signature" };
      
      try {
        const AdmZip = require("adm-zip");
        const nodeBuffer = Buffer.from(new Uint8Array(buffer));
        const zip = new AdmZip(nodeBuffer);
        const entries = zip.getEntries();
        
        // Anti-zip-bomb limits
        if (entries.length > 500) {
          return { valid: false, error: "DOCX has too many entries (zip bomb protection)" };
        }
        
        let hasContentTypes = false;
        let hasWordDoc = false;
        let uncompressedSize = 0;
        
        for (const entry of entries) {
          // Prevent path traversal in zip
          if (entry.entryName.includes("..") || entry.entryName.startsWith("/")) {
             return { valid: false, error: "DOCX contains invalid paths (traversal)" };
          }
          if (entry.entryName.includes("[Content_Types].xml")) hasContentTypes = true;
          if (entry.entryName.startsWith("word/document.xml")) hasWordDoc = true;
          uncompressedSize += entry.header.size;
        }

        if (uncompressedSize > 100 * 1024 * 1024) {
          return { valid: false, error: "DOCX uncompressed size exceeds limit" };
        }
        
        if (!hasContentTypes) return { valid: false, error: "Invalid DOCX structure (missing Content_Types)" };
        if (!hasWordDoc) return { valid: false, error: "Invalid DOCX structure (missing word/ content)" };

      } catch (err) {
        return { valid: false, error: "Invalid DOCX zip structure: " + err.message };
      }
      break;

    case "png":
      if (!matches([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return { valid: false, error: "Invalid PNG signature" };
      break;

    case "jpeg":
    case "jpg":
      if (!matches([0xFF, 0xD8, 0xFF])) return { valid: false, error: "Invalid JPEG signature" };
      break;

    case "webp":
      // RIFF....WEBP
      if (!matches([0x52, 0x49, 0x46, 0x46])) return { valid: false, error: "Invalid WebP signature (RIFF)" };
      if (!matches([0x57, 0x45, 0x42, 0x50], 8)) return { valid: false, error: "Invalid WebP signature (WEBP)" };
      break;

    case "txt":
    case "csv":
      // Check for NULs or heavy binary content in the first 8KB
      const checkLen = Math.min(buffer.length, 8192);
      for (let i = 0; i < checkLen; i++) {
        if (buffer[i] === 0x00) {
          return { valid: false, error: "Binary NUL byte found in text/csv file" };
        }
      }
      break;

    default:
      return { valid: false, error: `Unsupported extension: ${ext}` };
  }

  // Reject HTML/SVG content explicitly if someone renames a file
  const htmlTag = Buffer.from("<html");
  const svgTag = Buffer.from("<svg");
  const scriptTag = Buffer.from("<script");
  const first8k = buffer.subarray(0, 8192).toString("utf-8").toLowerCase();
  
  if (first8k.includes("<html") || first8k.includes("<svg") || first8k.includes("<script")) {
     // Be careful with TXT files containing these, but for security, if it's supposed to be an image or PDF, it definitely shouldn't start with these.
     // If it's TXT/CSV it might, but we explicitly disallow executable tags just to be completely safe against polyglots.
     if (ext !== "txt" && ext !== "csv") {
        return { valid: false, error: "Prohibited HTML/SVG content detected" };
     }
  }

  return { valid: true };
}
