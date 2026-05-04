import { NextResponse } from "next/server";
import createSupabaseServerClient from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/db/admin";

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
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

export async function requireOwnedOrg(orgId) {
  const parsedOrgId = parsePositiveInt(orgId);

  if (!parsedOrgId) return { error: jsonError("Invalid organization id", 400) };

  const auth = await requireUser();
  if (auth.error) return auth;

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

  const orgAuth = await requireOwnedOrg(row.organization_id);
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

  const orgAuth = await requireOwnedOrg(assistant.organization_id);
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

  const orgAuth = await requireOwnedOrg(tag.org_id);
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

  if (!broadcast)
    return { error: jsonError("Scheduled broadcast not found", 404) };

  const orgAuth = await requireOwnedOrg(broadcast.organization_id);
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
    .select("id, user_id, assistant_id")
    .eq("id", parsedThreadId)
    .maybeSingle();

  if (error) {
    console.error("[Auth] thread lookup failed", error);
    return { error: jsonError("Authorization check failed", 500) };
  }

  if (!thread) return { error: jsonError("Thread not found", 404) };

  let orgId = null;

  if (thread.user_id) {
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

  const orgAuth = await requireOwnedOrg(orgId);
  if (orgAuth.error) return orgAuth;

  return { ...orgAuth, thread, threadId: parsedThreadId };
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
    const err = new Error(
      "One or more users do not belong to this organization",
    );
    err.status = 403;
    throw err;
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
    const err = new Error(
      "One or more tags do not belong to this organization",
    );
    err.status = 403;
    throw err;
  }

  return uniqueIds;
}

export async function assertAssistantBelongsToOrg(admin, orgId, assistantId) {
  if (assistantId == null || assistantId === "") return null;

  const parsedAssistantId = parsePositiveInt(assistantId);
  if (!parsedAssistantId) {
    const err = new Error("Invalid assistant id");
    err.status = 400;
    throw err;
  }

  const { data, error } = await admin
    .from("assistant")
    .select("id")
    .eq("id", parsedAssistantId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error("Assistant does not belong to this organization");
    err.status = 403;
    throw err;
  }

  return parsedAssistantId;
}
