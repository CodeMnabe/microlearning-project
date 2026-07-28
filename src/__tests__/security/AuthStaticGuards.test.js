import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("AuthStaticGuards", () => {
  const searchFiles = (dir, pattern, checkFn) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        searchFiles(fullPath, pattern, checkFn);
      } else if (file.match(pattern)) {
        checkFn(fullPath);
      }
    });
  };

  it('Zero occurrences of flowType: "implicit" in src/utils/supabase/', () => {
    const dir = path.join(process.cwd(), "src", "utils", "supabase");
    searchFiles(dir, /\.jsx?|\.tsx?$/, (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/flowType\s*:\s*['"]implicit['"]/i);
    });
  });

  it("Zero occurrences of window.location.hash in src/app/[locale]/(auth)/", () => {
    const dir = path.join(process.cwd(), "src", "app", "[locale]", "(auth)");
    searchFiles(dir, /\.jsx?|\.tsx?$/, (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/window\.location\.hash/);
    });
  });

  it("Zero occurrences of setSession in src/app/[locale]/(auth)/", () => {
    const dir = path.join(process.cwd(), "src", "app", "[locale]", "(auth)");
    searchFiles(dir, /\.jsx?|\.tsx?$/, (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/\.setSession\(/);
    });
  });

  it("Password policy minLength is at least 12", () => {
    const filePath = path.join(
      process.cwd(),
      "src",
      "lib",
      "auth",
      "passwordPolicy.js",
    );
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const minLengthMatch = content.match(/minLength\s*:\s*(\d+)/);
      if (minLengthMatch) {
        expect(parseInt(minLengthMatch[1], 10)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("No password/token/code logging", () => {
    const dir = path.join(process.cwd(), "src", "lib", "auth");
    searchFiles(dir, /\.js$/, (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(
        /console\.log\([^)]*\b(password|token|code)\b[^)]*\)/i,
      );
      expect(content).not.toMatch(
        /logger\.\w+\([^)]*\b(password|token|code)\b[^)]*\)/i,
      );
    });
  });

  it("supabase/config.toml has minimum_password_length >= 12", () => {
    const filePath = path.join(process.cwd(), "supabase", "config.toml");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(/minimum_password_length\s*=\s*(\d+)/);
      if (match) {
        expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("supabase/config.toml has password_requirements set", () => {
    const filePath = path.join(process.cwd(), "supabase", "config.toml");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      // Look for custom password requirements or regex
      expect(
        content.includes("password_requirements") ||
          content.includes("password_pattern"),
      ).toBe(true); // Adjust as needed
    }
  });
});
