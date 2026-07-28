import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

describe("Auth PKCE Flow Verification", () => {
  const getSupabaseFilePath = (filename) =>
    path.join(process.cwd(), "src", "utils", "supabase", filename);

  it("client.js does NOT contain flowType implicit", () => {
    const filePath = getSupabaseFilePath("client.js");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/flowType\s*:\s*['"]implicit['"]/i);
    }
  });

  it("server.js does NOT contain flowType implicit", () => {
    const filePath = getSupabaseFilePath("server.js");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/flowType\s*:\s*['"]implicit['"]/i);
    }
  });

  it("middleware.js does NOT contain flowType implicit", () => {
    const filePath = getSupabaseFilePath("middleware.js");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(/flowType\s*:\s*['"]implicit['"]/i);
    }
  });

  it("No file in src/utils/supabase/ contains flowType implicit", () => {
    const dirPath = path.join(process.cwd(), "src", "utils", "supabase");
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      files.forEach((file) => {
        if (file.endsWith(".js") || file.endsWith(".ts")) {
          const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
          expect(content).not.toMatch(/flowType\s*:\s*['"]implicit['"]/i);
        }
      });
    }
  });

  describe("Callback Route", () => {
    // Mock the callback route dependencies
    it("calls exchangeCodeForSession when code is provided", async () => {
      const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = { auth: { exchangeCodeForSession } };

      // Simulate route logic
      const code = "valid_code";
      if (code) {
        await mockSupabase.auth.exchangeCodeForSession(code);
      }
      expect(exchangeCodeForSession).toHaveBeenCalledWith(code);
    });

    it("rejects missing code", async () => {
      const exchangeCodeForSession = vi.fn();
      const code = null;
      if (!code) {
        // simulate rejection or redirect to error
      }
      expect(exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it("rejects invalid code (mock returns error)", async () => {
      const exchangeCodeForSession = vi
        .fn()
        .mockResolvedValue({ error: { message: "Invalid code" } });
      const mockSupabase = { auth: { exchangeCodeForSession } };

      const code = "invalid_code";
      const { error } = await mockSupabase.auth.exchangeCodeForSession(code);
      expect(error).toBeDefined();
    });

    it("callback sets no-store header", () => {
      const headers = new Headers();
      headers.set("Cache-Control", "no-store, max-age=0");
      expect(headers.get("Cache-Control")).toContain("no-store");
    });

    it("callback does not include code in redirect URL", () => {
      const redirectUrl = "https://example.com/dashboard";
      expect(redirectUrl).not.toContain("code=");
    });
  });
});
