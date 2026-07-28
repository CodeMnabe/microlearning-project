import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("AuthSessionSecurity", () => {
  vi.mock("@supabase/ssr", () => ({
    createServerClient: vi.fn(() => ({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    })),
  }));
  const readSafe = (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
      }
    } catch (e) {
      // Ignore
    }
    return "";
  };

  it("auth callback route uses Cache-Control private, no-store", async () => {
    vi.mock("next/headers", () => ({
      cookies: vi.fn(() =>
        Promise.resolve({
          getAll: () => [],
          setAll: () => {},
        }),
      ),
    }));
    const { GET } = await import("@/app/api/auth/callback/route");
    const req = new Request("http://localhost:3000/api/auth/callback?code=abc");
    const res = await GET(req);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
    expect(res.headers.get("Cache-Control")).toMatch(/private/i);
  });

  it("signout route uses Cache-Control private, no-store", async () => {
    vi.mock("next/headers", () => ({
      cookies: vi.fn(() =>
        Promise.resolve({
          getAll: () => [],
          setAll: () => {},
        }),
      ),
    }));
    const { POST } = await import("@/app/api/auth/signout/route");
    const req = new Request("http://localhost:3000/api/auth/signout", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
    expect(res.headers.get("Cache-Control")).toMatch(/private/i);
  });

  it("No server-side singleton Supabase client exists", () => {
    const dirPath = path.join(process.cwd(), "src", "utils", "supabase");
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      let foundSingleton = false;
      files.forEach((file) => {
        if (file.endsWith(".js") || file.endsWith(".ts")) {
          const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
          // Look for global variable or unexported instance cache
          if (content.match(/const\s+supabase\s*=\s*createClient/)) {
            // If they export it as a singleton rather than a factory function
            if (!content.match(/export\s+function/)) {
              foundSingleton = true;
            }
          }
        }
      });
      expect(foundSingleton).toBe(false); // Should use factory functions
    }
  });

  it("No access_token in URL params of auth routes", () => {
    const authDir = path.join(
      process.cwd(),
      "src",
      "app",
      "[locale]",
      "(auth)",
    );
    if (fs.existsSync(authDir)) {
      // Basic check
      const checkRecursive = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            checkRecursive(fullPath);
          } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
            const content = fs.readFileSync(fullPath, "utf-8");
            expect(content).not.toMatch(
              /searchParams\.get\(['"]access_token['"]\)/,
            );
          }
        });
      };
      checkRecursive(authDir);
    }
  });

  it("No localStorage usage in auth modules", () => {
    const authLibDir = path.join(process.cwd(), "src", "lib", "auth");
    if (fs.existsSync(authLibDir)) {
      const files = fs.readdirSync(authLibDir);
      files.forEach((file) => {
        if (file.endsWith(".js") || file.endsWith(".ts")) {
          const content = fs.readFileSync(path.join(authLibDir, file), "utf-8");
          expect(content).not.toMatch(/localStorage\.setItem/);
          expect(content).not.toMatch(/localStorage\.getItem/);
        }
      });
    }
  });
});
