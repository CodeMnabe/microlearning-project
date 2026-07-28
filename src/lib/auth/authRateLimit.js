import "server-only";
import { consumeCapacitySet } from "@/lib/repos/requestCapacity.repo";
import { deriveClientIdentity } from "@/lib/security/clientIdentity";
import { deriveOpaqueIdentifier } from "@/lib/security/opaqueIdentity";
import { AUTH_RATE_LIMITS } from "@/lib/limits/authRateLimits";

export async function checkAuthRateLimit(request, scope, email) {
  const limits =
    scope === "login"
      ? {
          global: AUTH_RATE_LIMITS.loginGlobal,
          ip: AUTH_RATE_LIMITS.loginIp,
          account: AUTH_RATE_LIMITS.loginAccount,
        }
      : {
          global: AUTH_RATE_LIMITS.resetGlobal,
          ip: AUTH_RATE_LIMITS.resetIp,
          account: AUTH_RATE_LIMITS.resetAccount,
        };

  const entries = [
    {
      scope: limits.global.scope,
      subjectHash: deriveOpaqueIdentifier(`${scope}-global`, "all"),
      windowSeconds: limits.global.windowSeconds,
      maximumRequests: limits.global.maximumRequests,
    },
    {
      scope: limits.ip.scope,
      subjectHash: deriveClientIdentity(request, `auth-${scope}-ip`)
        .subjectHash,
      windowSeconds: limits.ip.windowSeconds,
      maximumRequests: limits.ip.maximumRequests,
    },
  ];

  if (email && typeof email === "string" && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    entries.push({
      scope: limits.account.scope,
      subjectHash: deriveOpaqueIdentifier(
        `auth-${scope}-account`,
        normalizedEmail,
      ),
      windowSeconds: limits.account.windowSeconds,
      maximumRequests: limits.account.maximumRequests,
    });
  }

  return consumeCapacitySet(entries);
}
