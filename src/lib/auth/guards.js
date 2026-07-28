import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import createSupabaseServerClient from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/db/admin";
import { logger } from "@/lib/observability/logger";
import { getAssuranceLevel } from "@/lib/auth/mfa";

const AAL_VALIDATED = Symbol("AAL_VALIDATED");
const RESOURCE_NOT_FOUND_MESSAGE = "Resource not found";

export function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function cleanPatch(input = {}, allowed = []) {
  return Object.fromEntries(
    Object.entries(input || {}).filter(
      ([key, value]) => allowed.includes(key) && value !== undefined,
    ),
  );
}

export function getHttpStatus(error, fallback = 500) {
  const status = Number(error?.status || error?.statusCode);
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : fallback;
}

export function handleApiError(error, fallbackMessage = "Request failed") {
  const status = getHttpStatus(error);
  const message =
    status >= 500 ? fallbackMessage : error?.message || fallbackMessage;

  if (status >= 500) {
    logger.error(
      "api_request_failed",
      {
        provider: "internal",
        operation: "api_handler",
        outcome: "failed",
        statusCode: status,
      },
      error,
    );
  }

  return jsonError(message, status);
}

export function throwHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function requireUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: jsonError("Unauthorized", 401) };
  }

  return {
    user,
    supabase,
    admin: getSupabaseAdminClient(),
  };
}

export async function requirePrivilegedUser(existingAuth = null) {
  const auth = existingAuth || (await requireUser());
  if (auth.error) return auth;

  if (auth[AAL_VALIDATED]) return auth;

  if (
    !auth.supabase ||
    typeof auth.supabase.auth?.mfa?.getAuthenticatorAssuranceLevel !==
      "function"
  ) {
    return { error: jsonError("Invalid auth context", 500) };
  }

  try {
    const data = await getAssuranceLevel(auth.supabase);

    if (data.currentLevel !== "aal2" || data.nextLevel !== "aal2") {
      return { error: jsonError("MFA required", 403) };
    }

    return {
      ...auth,
      [AAL_VALIDATED]: true,
      aal: data.currentLevel,
      nextAal: data.nextLevel,
    };
  } catch {
    return { error: jsonError("Failed to determine assurance level", 500) };
  }
}

function hiddenResourceError(operation, outcome) {
  logger.info("authorization_resource_hidden", {
    provider: "supabase",
    operation,
    outcome,
  });

  return { error: jsonError(RESOURCE_NOT_FOUND_MESSAGE, 404) };
}

async function authorizeOwnedOrg(
  auth,
  orgId,
  { hideResourceExistence = false, operation = null } = {},
) {
  const parsedOrgId = parsePositiveInt(orgId);

  if (!parsedOrgId) {
    return { error: jsonError("Invalid organization id", 400) };
  }

  const { data: org, error } = await auth.admin
    .from("organization")
    .select("id, owner_user_id")
    .eq("id", parsedOrgId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "organization_lookup",
        outcome: "failed",
        organizationId: parsedOrgId,
      },
      error,
    );
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!org || org.owner_user_id !== auth.user.id) {
    if (hideResourceExistence && operation) {
      return hiddenResourceError(operation, org ? "cross_tenant" : "not_found");
    }

    return { error: jsonError("Forbidden", 403) };
  }

  return { ...auth, org, orgId: parsedOrgId };
}

export async function requireOwnedOrg(orgId, existingAuth = null) {
  const auth = await requirePrivilegedUser(existingAuth);
  if (auth.error) return auth;

  return authorizeOwnedOrg(auth, orgId);
}

export async function requireOrgForUser(userId) {
  const parsedUserId = parsePositiveInt(userId);
  if (!parsedUserId) return { error: jsonError("Invalid user id", 400) };

  const auth = await requirePrivilegedUser();
  if (auth.error) return auth;

  const { data: row, error } = await auth.admin
    .from("user")
    .select("id, organization_id")
    .eq("id", parsedUserId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "user_lookup",
        outcome: "failed",
        userId: parsedUserId,
      },
      error,
    );
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!row) return hiddenResourceError("user_lookup", "not_found");

  const orgAuth = await authorizeOwnedOrg(auth, row.organization_id, {
    hideResourceExistence: true,
    operation: "user_lookup",
  });
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, targetUser: row, userId: parsedUserId };
}

export async function requireOrgForAssistant(assistantId) {
  const parsedAssistantId = parsePositiveInt(assistantId);
  if (!parsedAssistantId) {
    return { error: jsonError("Invalid assistant id", 400) };
  }

  const auth = await requirePrivilegedUser();
  if (auth.error) return auth;

  const { data: assistant, error } = await auth.admin
    .from("assistant")
    .select("*")
    .eq("id", parsedAssistantId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "assistant_lookup",
        outcome: "failed",
        assistantId: parsedAssistantId,
      },
      error,
    );
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!assistant) {
    return hiddenResourceError("assistant_lookup", "not_found");
  }

  const orgAuth = await authorizeOwnedOrg(auth, assistant.organization_id, {
    hideResourceExistence: true,
    operation: "assistant_lookup",
  });
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, assistant, assistantId: parsedAssistantId };
}

export async function requireOrgForTag(tagId) {
  const parsedTagId = parsePositiveInt(tagId);
  if (!parsedTagId) return { error: jsonError("Invalid tag id", 400) };

  const auth = await requirePrivilegedUser();
  if (auth.error) return auth;

  const { data: tag, error } = await auth.admin
    .from("tags")
    .select("id, org_id")
    .eq("id", parsedTagId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "tag_lookup",
        outcome: "failed",
      },
      error,
    );
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!tag) return hiddenResourceError("tag_lookup", "not_found");

  const orgAuth = await authorizeOwnedOrg(auth, tag.org_id, {
    hideResourceExistence: true,
    operation: "tag_lookup",
  });
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, tag, tagId: parsedTagId };
}

export async function requireOrgForScheduledBroadcast(id) {
  const broadcastId = typeof id === "string" ? id.trim() : "";

  const isValidUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      broadcastId,
    );

  if (!isValidUuid) {
    return {
      error: jsonError("Invalid scheduled broadcast id", 400),
    };
  }

  const auth = await requirePrivilegedUser();
  if (auth.error) return auth;

  const { data: broadcast, error } = await auth.admin
    .from("scheduled_broadcast")
    .select(
      "id, organization_id, status, scheduled_for, payload, created_by_user_id",
    )
    .eq("id", broadcastId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "scheduled_broadcast_lookup",
        outcome: "failed",
        broadcastId,
      },
      error,
    );

    return {
      error: jsonError("Authorization check failed", 500),
    };
  }

  if (!broadcast) {
    return hiddenResourceError("scheduled_broadcast_lookup", "not_found");
  }

  const orgAuth = await authorizeOwnedOrg(auth, broadcast.organization_id, {
    hideResourceExistence: true,
    operation: "scheduled_broadcast_lookup",
  });

  if (orgAuth.error) return orgAuth;

  return {
    ...orgAuth,
    broadcast,
    broadcastId,
  };
}

export async function requireOrgForThread(threadId) {
  const parsedThreadId = parsePositiveInt(threadId);
  if (!parsedThreadId) return { error: jsonError("Invalid thread id", 400) };

  const auth = await requirePrivilegedUser();
  if (auth.error) return auth;

  const { data: thread, error } = await auth.admin
    .from("thread")
    .select("*")
    .eq("id", parsedThreadId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "thread_lookup",
        outcome: "failed",
      },
      error,
    );
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!thread) return hiddenResourceError("thread_lookup", "not_found");

  let orgId = thread.organization_id ?? null;

  if (thread.user_id) {
    const { data: userRow, error: userError } = await auth.admin
      .from("user")
      .select("organization_id")
      .eq("id", thread.user_id)
      .maybeSingle();

    if (userError) {
      logger.error(
        "authorization_lookup_failed",
        {
          provider: "supabase",
          operation: "thread_user_lookup",
          outcome: "failed",
        },
        userError,
      );
      return { error: jsonError("Authorization check failed", 500) };
    }

    orgId = userRow?.organization_id ?? null;
  }

  if (!orgId && thread.assistant_id) {
    const { data: assistant, error: assistantError } = await auth.admin
      .from("assistant")
      .select("organization_id")
      .eq("id", thread.assistant_id)
      .maybeSingle();

    if (assistantError) {
      logger.error(
        "authorization_lookup_failed",
        {
          provider: "supabase",
          operation: "thread_assistant_lookup",
          outcome: "failed",
        },
        assistantError,
      );
      return { error: jsonError("Authorization check failed", 500) };
    }

    orgId = assistant?.organization_id ?? null;
  }

  if (!orgId) return hiddenResourceError("thread_lookup", "not_found");

  const orgAuth = await authorizeOwnedOrg(auth, orgId, {
    hideResourceExistence: true,
    operation: "thread_lookup",
  });
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, thread, threadId: parsedThreadId };
}

export async function requireOrgForAutomationRule(id) {
  const ruleId = typeof id === "string" ? id.trim() : "";

  if (!isUuid(ruleId)) {
    return { error: jsonError("Invalid automation rule id", 400) };
  }

  const auth = await requirePrivilegedUser();
  if (auth.error) return auth;

  const { data: rule, error } = await auth.admin
    .from("automation_rule")
    .select("id, organization_id, assistant_id")
    .eq("id", ruleId)
    .maybeSingle();

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "automation_rule_lookup",
        outcome: "failed",
      },
      error,
    );
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!rule) {
    return hiddenResourceError("automation_rule_lookup", "not_found");
  }

  const orgAuth = await authorizeOwnedOrg(auth, rule.organization_id, {
    hideResourceExistence: true,
    operation: "automation_rule_lookup",
  });
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, rule, ruleId };
}

export async function assertUsersBelongToOrg(admin, orgId, userIds) {
  const uniqueIds = [...new Set((userIds || []).map(Number).filter(Boolean))];
  if (!uniqueIds.length) return [];

  const { data, error } = await admin
    .from("user")
    .select("id")
    .eq("organization_id", orgId)
    .in("id", uniqueIds);

  if (error) throw error;

  const found = new Set((data || []).map((row) => Number(row.id)));
  const missing = uniqueIds.filter((id) => !found.has(id));

  if (missing.length) {
    throwHttpError("One or more users do not belong to this organization", 403);
  }

  return uniqueIds;
}

export async function assertTagsBelongToOrg(admin, orgId, tagIds) {
  const uniqueIds = [...new Set((tagIds || []).map(Number).filter(Boolean))];
  if (!uniqueIds.length) return [];

  const { data, error } = await admin
    .from("tags")
    .select("id")
    .eq("org_id", orgId)
    .in("id", uniqueIds);

  if (error) throw error;

  const found = new Set((data || []).map((row) => Number(row.id)));
  const missing = uniqueIds.filter((id) => !found.has(id));

  if (missing.length) {
    throwHttpError("One or more tags do not belong to this organization", 403);
  }

  return uniqueIds;
}

export async function assertAssistantBelongsToOrg(admin, orgId, assistantId) {
  if (assistantId == null || assistantId === "") return null;

  const parsedAssistantId = parsePositiveInt(assistantId);
  if (!parsedAssistantId) throwHttpError("Invalid assistant id", 400);

  const { data, error } = await admin
    .from("assistant")
    .select("id")
    .eq("id", parsedAssistantId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throwHttpError("Assistant does not belong to this organization", 403);
  }

  return parsedAssistantId;
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export async function assertWhatsappTemplateBelongsToOrg(
  admin,
  orgId,
  templateId,
) {
  if (templateId == null || templateId === "") return null;

  if (typeof templateId !== "string") {
    throwHttpError("Invalid WhatsApp template id", 400);
  }

  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("id, org_id")
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throwHttpError("WhatsApp template not found", 404);

  if (data.org_id != null && Number(data.org_id) !== Number(orgId)) {
    throwHttpError(
      "WhatsApp template does not belong to this organization",
      403,
    );
  }

  return templateId;
}

export async function assertWhatsappProviderTemplateBelongsToOrg(
  admin,
  orgId,
  providerTemplateId,
) {
  const normalizedId = String(providerTemplateId || "").trim();
  if (!normalizedId) return null;

  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("id, org_id, provider_template_id")
    .eq("provider_template_id", normalizedId);

  if (error) throw error;

  const template = (data || []).find(
    (row) => row.org_id == null || Number(row.org_id) === Number(orgId),
  );

  if (!template) {
    throwHttpError(
      "WhatsApp template does not belong to this organization",
      403,
    );
  }

  return template;
}

export function extractRecipientUserIds(recipients = []) {
  if (!Array.isArray(recipients)) return [];

  return [
    ...new Set(
      recipients
        .map((recipient) =>
          typeof recipient === "object"
            ? Number(recipient.userId ?? recipient.id)
            : null,
        )
        .filter(Boolean),
    ),
  ];
}

export function requireAllRecipientsToBeKnownUsers(recipients = []) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throwHttpError("At least one recipient is required", 400);
  }

  const ids = extractRecipientUserIds(recipients);

  if (ids.length !== recipients.length) {
    throwHttpError(
      "For security, broadcast recipients must be selected users, not raw phone numbers.",
      400,
    );
  }

  return ids;
}

const TEAMS_JWKS = createRemoteJWKSet(
  new URL("https://login.botframework.com/v1/.well-known/keys"),
);

function getTeamsJwtConfig() {
  const appId = process.env.BOT_APP_ID?.trim();
  const tenantId = process.env.AZURE_TENANT_ID?.trim() || null;

  if (!appId) {
    throwHttpError("Missing BOT_APP_ID", 500);
  }

  return { appId, tenantId };
}

export async function requireValidTeamsRequest(req, activity) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return { error: jsonError("Unauthorized", 401) };
  }

  const token = match[1].trim();
  if (!token) {
    return { error: jsonError("Unauthorized", 401) };
  }

  const { appId } = getTeamsJwtConfig();

  try {
    const { payload } = await jwtVerify(token, TEAMS_JWKS, {
      audience: appId,
      issuer: "https://api.botframework.com",
      algorithms: ["RS256"],
    });

    const tokenServiceUrl = String(payload.serviceurl || "")
      .trim()
      .replace(/\/$/, "");
    const activityServiceUrl = String(activity?.serviceUrl || "")
      .trim()
      .replace(/\/$/, "");

    if (!tokenServiceUrl || !activityServiceUrl) {
      return { error: jsonError("Unauthorized", 401) };
    }

    if (tokenServiceUrl !== activityServiceUrl) {
      return { error: jsonError("Unauthorized", 401) };
    }

    return { ok: true, payload };
  } catch (error) {
    logger.warn(
      "webhook_validation_failed",
      {
        provider: "teams",
        operation: "request_authentication",
        outcome: "rejected",
      },
      error,
    );
    return { error: jsonError("Unauthorized", 401) };
  }
}
