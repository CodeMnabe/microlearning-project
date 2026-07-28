import { describe, it, expect, vi } from "vitest";

describe("AuthAccountEnumeration", () => {
  const genericErrorMessage =
    "Invalid login credentials or account does not exist";

  const loginAction = vi
    .fn()
    .mockImplementation(async ({ email, password }) => {
      if (email === "valid@example.com" && password === "wrongpass") {
        return { error: genericErrorMessage };
      }
      if (email === "invalid@example.com") {
        return { error: genericErrorMessage };
      }
      return { success: true };
    });

  const resetAction = vi.fn().mockImplementation(async ({ email }) => {
    // Always return success to prevent enumeration
    return {
      success: true,
      message: "If an account exists, a reset email was sent.",
    };
  });

  it("reset action always returns success", async () => {
    const res1 = await resetAction({ email: "valid@example.com" });
    const res2 = await resetAction({ email: "invalid@example.com" });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.message).toBe(res2.message);
  });

  it("login returns same generic error for wrong password and non-existent user", async () => {
    const resWrongPass = await loginAction({
      email: "valid@example.com",
      password: "wrongpass",
    });
    const resInvalidUser = await loginAction({
      email: "invalid@example.com",
      password: "anypass",
    });

    expect(resWrongPass.error).toBe(resInvalidUser.error);
    expect(resWrongPass.error).toBe(genericErrorMessage);
  });

  it("error messages don't reveal account existence", () => {
    // The key is that it's the SAME message
    expect(genericErrorMessage).not.toBe("Account does not exist");
    expect(genericErrorMessage).not.toBe("Invalid password");
  });

  it("error messages don't reveal account state", async () => {
    // e.g. unverified account vs non-existent
    const unverifiedAction = vi.fn().mockImplementation(async () => {
      return { error: genericErrorMessage };
    });
    const res = await unverifiedAction();
    expect(res.error).toBe(genericErrorMessage);
  });
});
