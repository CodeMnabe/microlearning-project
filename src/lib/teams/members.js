import { getBotToken } from "@/lib/teams/auth";

/*
 * Teams service URLs are Microsoft hosts. The bot token is never sent
 * anywhere else, even if a stored URL was tampered with.
 */
const TRUSTED_HOST_SUFFIXES = [
  ".trafficmanager.net",
  ".botframework.com",
  ".teams.microsoft.com",
];

export function isTrustedTeamsServiceUrl(value) {
  try {
    const url = new URL(String(value || ""));

    return (
      url.protocol === "https:" &&
      TRUSTED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

/**
 * A member of a Teams conversation as Microsoft sees it (#153): email,
 * login name (UPN) and Microsoft id. Null when it cannot be read.
 */
export async function getTeamsMember({ serviceUrl, conversationId, memberId }) {
  if (!memberId || !conversationId || !isTrustedTeamsServiceUrl(serviceUrl)) {
    return null;
  }

  const token = await getBotToken();
  const base = String(serviceUrl).replace(/\/$/, "");

  const res = await fetch(
    `${base}/v3/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(memberId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);

  if (!data) return null;

  return {
    email: data.email ?? null,
    userPrincipalName: data.userPrincipalName ?? null,
    aadObjectId: data.aadObjectId ?? null,
  };
}

/* Email and login name, lower case, without repeats. */
export function memberEmails(member) {
  return [
    ...new Set(
      [member?.email, member?.userPrincipalName]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => value.includes("@")),
    ),
  ];
}
