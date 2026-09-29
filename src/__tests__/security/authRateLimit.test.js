import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  rpc: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/db/admin", () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import {
  consumeAuthAttempt,
  getClientIp,
} from "@/lib/auth/authRateLimit";

function headerStore(values) {
  return { get: (name) => values[name] || null };
}

describe("auth rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      headerStore({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" }),
    );
    mocks.getSupabaseAdminClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("usa o primeiro IP encaminhado", () => {
    expect(
      getClientIp(
        headerStore({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.8");
  });

  it("consome email normalizado e IP na mesma RPC", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(consumeAuthAttempt("login", " Owner@Example.COM ")).resolves.toBe(
      true,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("consume_auth_attempt", {
      p_action: "login",
      p_email_hash: createHash("sha256")
        .update("email:owner@example.com")
        .digest("hex"),
      p_ip_hash: createHash("sha256")
        .update("ip:203.0.113.8")
        .digest("hex"),
    });
  });

  it("propaga falhas da base de dados para o chamador bloquear", async () => {
    const error = new Error("rpc unavailable");
    mocks.rpc.mockResolvedValueOnce({ data: null, error });
    await expect(consumeAuthAttempt("reset", "a@example.com")).rejects.toBe(
      error,
    );
  });

  it("permite autenticar durante o rollout anterior à migration", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "function not found" },
    });
    await expect(consumeAuthAttempt("login", "a@example.com")).resolves.toBe(
      true,
    );
  });
});
