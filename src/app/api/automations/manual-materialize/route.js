import { NextResponse } from "next/server";
import { requireOwnedOrg } from "@/lib/auth/guards";
import { materializeDueAutomationsForOrganization } from "@/lib/services/automations/materializeDueAutomations";
import { logger } from "@/lib/observability/logger";
import crypto from "crypto";

export const maxDuration = 300;

async function enforceRateLimits(admin, orgId, userId, action) {
  // 1. Organization limit
  const orgHash = crypto.createHash("sha256").update(`org:${orgId}`).digest("hex");
  const { data: orgData } = await admin.rpc("consume_request_capacity", { p_scope: "manual-materialize-org", p_subject_hash: orgHash, p_window_seconds: 60, p_maximum_requests: 10 });
  if (!orgData?.accepted) return { ok: false, retryAfter: orgData?.retry_after_seconds || 60 };

  // 2. Actor limit
  const actorHash = crypto.createHash("sha256").update(`actor:${userId}`).digest("hex");
  const { data: actorData } = await admin.rpc("consume_request_capacity", { p_scope: "manual-materialize-actor", p_subject_hash: actorHash, p_window_seconds: 60, p_maximum_requests: 5 });
  if (!actorData?.accepted) return { ok: false, retryAfter: actorData?.retry_after_seconds || 60 };

  // 3. Action limit
  const actionHash = crypto.createHash("sha256").update(`action:${orgId}:${action}`).digest("hex");
  const { data: actionData } = await admin.rpc("consume_request_capacity", { p_scope: "manual-materialize-action", p_subject_hash: actionHash, p_window_seconds: 60, p_maximum_requests: 1 });
  if (!actionData?.accepted) return { ok: false, retryAfter: actionData?.retry_after_seconds || 60 };

  return { ok: true };
}

export async function POST(req) {
  try {
    const rawContentType = req.headers.get("content-type") || "";
    const contentType = rawContentType.split(";")[0].trim().toLowerCase();
    
    if (contentType !== "application/json") {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 400 });
    }

    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be a simple JSON object" }, { status: 400 });
    }

    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "organizationId") {
      return NextResponse.json({ error: "Body must contain exactly one property: organizationId" }, { status: 400 });
    }

    if (typeof body.organizationId !== "number" || !Number.isInteger(body.organizationId) || body.organizationId <= 0) {
      return NextResponse.json({ error: "organizationId must be a positive integer" }, { status: 400 });
    }

    const orgId = body.organizationId;

    const auth = await requireOwnedOrg(orgId);
    if (auth.error) return auth.error;

    const rateLimit = await enforceRateLimits(auth.admin, orgId, auth.user.id, "materialize");
    if (!rateLimit.ok) {
      logger.warn("manual_automation_run_rejected", {
        provider: "internal",
        operation: "manual_automation_run",
        outcome: "rejected",
        organizationId: orgId,
        userId: auth.user.id,
        statusCode: 429,
      });
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      });
    }

    logger.info("manual_automation_run_requested", {
      provider: "internal",
      operation: "manual_automation_run",
      outcome: "requested",
      organizationId: orgId,
      userId: auth.user.id,
    });

    const result = await materializeDueAutomationsForOrganization({ organizationId: orgId, limit: 200 });

    logger.info("manual_automation_run_completed", {
      provider: "internal",
      operation: "manual_automation_run",
      outcome: "completed",
      organizationId: orgId,
      userId: auth.user.id,
      processed: result.materialized || 0,
      skipped: result.skipped || 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "manual_automation_run_failed",
      {
        provider: "internal",
        operation: "manual_automation_run",
        outcome: "failed",
        statusCode: 500,
      },
      error,
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
