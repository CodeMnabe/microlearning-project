import { NextResponse } from "next/server";
import createSupabaseServerClient from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/db/admin";

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
    console.error("[API]", error);
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

async function authorizeOwnedOrg(auth, orgId) {
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
    console.error("[Auth] organization lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!org || org.owner_user_id !== auth.user.id) {
    return { error: jsonError("Forbidden", 403) };
  }

  return { ...auth, org, orgId: parsedOrgId };
}

export async function requireOwnedOrg(orgId, existingAuth = null) {
  const auth = existingAuth || (await requireUser());
  if (auth.error) return auth;

  return authorizeOwnedOrg(auth, orgId);
}

export async function requireOrgForUser(userId) {
  const parsedUserId = parsePositiveInt(userId);
  if (!parsedUserId) return { error: jsonError("Invalid user id", 400) };

  const auth = await requireUser();
  if (auth.error) return auth;

  const { data: row, error } = await auth.admin
    .from("user")
    .select("id, organization_id")
    .eq("id", parsedUserId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] user lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!row) return { error: jsonError("User not found", 404) };

  const orgAuth = await requireOwnedOrg(row.organization_id, auth);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, targetUser: row, userId: parsedUserId };
}

export async function requireOrgForAssistant(assistantId) {
  const parsedAssistantId = parsePositiveInt(assistantId);
  if (!parsedAssistantId) {
    return { error: jsonError("Invalid assistant id", 400) };
  }

  const auth = await requireUser();
  if (auth.error) return auth;

  const { data: assistant, error } = await auth.admin
    .from("assistant")
    .select("*")
    .eq("id", parsedAssistantId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] assistant lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!assistant) return { error: jsonError("Assistant not found", 404) };

  const orgAuth = await requireOwnedOrg(assistant.organization_id, auth);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, assistant, assistantId: parsedAssistantId };
}

export async function requireOrgForTag(tagId) {
  const parsedTagId = parsePositiveInt(tagId);
  if (!parsedTagId) return { error: jsonError("Invalid tag id", 400) };

  const auth = await requireUser();
  if (auth.error) return auth;

  const { data: tag, error } = await auth.admin
    .from("tags")
    .select("id, org_id")
    .eq("id", parsedTagId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] tag lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!tag) return { error: jsonError("Tag not found", 404) };

  const orgAuth = await requireOwnedOrg(tag.org_id, auth);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, tag, tagId: parsedTagId };
}

export async function requireOrgForScheduledBroadcast(id) {
  const parsedId = parsePositiveInt(id);
  if (!parsedId) return { error: jsonError("Invalid broadcast id", 400) };

  const auth = await requireUser();
  if (auth.error) return auth;

  const { data: broadcast, error } = await auth.admin
    .from("scheduled_broadcast")
    .select("id, organization_id, status")
    .eq("id", parsedId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] scheduled broadcast lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!broadcast) {
    return { error: jsonError("Scheduled broadcast not found", 404) };
  }

  const orgAuth = await requireOwnedOrg(broadcast.organization_id, auth);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, broadcast, broadcastId: parsedId };
}

export async function requireOrgForThread(threadId) {
  const parsedThreadId = parsePositiveInt(threadId);
  if (!parsedThreadId) return { error: jsonError("Invalid thread id", 400) };

  const auth = await requireUser();
  if (auth.error) return auth;

  const { data: thread, error } = await auth.admin
    .from("thread")
    .select("id, user_id, assistant_id, organization_id")
    .eq("id", parsedThreadId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] thread lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!thread) return { error: jsonError("Thread not found", 404) };

  let orgId = thread.organization_id ?? null;

  if (!orgId && thread.user_id) {
    const { data: userRow, error: userError } = await auth.admin
      .from("user")
      .select("organization_id")
      .eq("id", thread.user_id)
      .maybeSingle();

    if (userError) {
      console.error("[Auth] thread user lookup failed", userError);
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
      console.error("[Auth] thread assistant lookup failed", assistantError);
      return { error: jsonError("Authorization check failed", 500) };
    }

    orgId = assistant?.organization_id ?? null;
  }

  if (!orgId) return { error: jsonError("Thread has no organization", 403) };

  const orgAuth = await requireOwnedOrg(orgId, auth);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, thread, threadId: parsedThreadId };
}

export async function requireOrgForAutomationRule(id) {
  const parsedId = parsePositiveInt(id);
  if (!parsedId) return { error: jsonError("Invalid automation rule id", 400) };

  const auth = await requireUser();
  if (auth.error) return auth;

  const { data: rule, error } = await auth.admin
    .from("automation_rule")
    .select("id, organization_id, assistant_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] automation rule lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!rule) return { error: jsonError("Automation rule not found", 404) };

  const orgAuth = await requireOwnedOrg(rule.organization_id, auth);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, rule, ruleId: parsedId };
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

export async function assertWhatsappTemplateBelongsToOrg(
  admin,
  orgId,
  templateId,
) {
  if (templateId == null || templateId === "") return null;

  const parsedTemplateId = parsePositiveInt(templateId);
  if (!parsedTemplateId) throwHttpError("Invalid WhatsApp template id", 400);

  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("id, org_id")
    .eq("id", parsedTemplateId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throwHttpError("WhatsApp template not found", 404);

  if (data.org_id != null && Number(data.org_id) !== Number(orgId)) {
    throwHttpError(
      "WhatsApp template does not belong to this organization",
      403,
    );
  }

  return parsedTemplateId;
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
