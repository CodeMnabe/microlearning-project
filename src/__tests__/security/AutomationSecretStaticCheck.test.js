import fs from "node:fs/promises";
import path from "node:path";

async function walkDir(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await walkDir(fullPath));
    } else if (fullPath.endsWith(".js") || fullPath.endsWith(".jsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Automation Secret Static Check", () => {
  it("ensures no secret leaks exist in client-side code", async () => {
    const appDir = path.join(process.cwd(), "src", "app");
    const files = await walkDir(appDir);

    const clientFiles = [];
    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      if (content.includes('"use client"') || content.includes("'use client'")) {
        clientFiles.push({ file, content });
      }
    }

    for (const { file, content } of clientFiles) {
      expect(content).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*SECRET/i);
      expect(content).not.toMatch(/NEXT_PUBLIC_CRON_SECRET/i);
      expect(content).not.toMatch(/process\.env\.CRON_SECRET/i);
      expect(content).not.toMatch(/Authorization:\s*`Bearer\s*\$\{\s*process\.env\./i);
      expect(content).not.toMatch(/import\s+.*["']server-only["']/i);
    }
  });
});
