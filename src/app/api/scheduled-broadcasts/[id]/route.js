import { NextResponse } from "next/server";
import {
  updateScheduledBroadcast,
  deleteScheduledBroadcast,
} from "@/lib/repos/scheduledBroadcasts.repo";
import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";
import {
  cleanPatch,
  handleApiError,
  requireOrgForScheduledBroadcast,
} from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PATCH_FIELDS = [
  "scheduled_for",
  "timezone",
  "status",
];

const ALLOWED_MANUAL_STATUSES = new Set([
  "queued",
  "cancelled",
]);

const MUTABLE_STATUSES = new Set([
  "queued",
]);

const DELETABLE_STATUSES = new Set([
  "queued",
  "cancelled",
]);

function isValidDate(value) {
  if (typeof value !== "string") return false;

  const normalized = value.trim();

  if (!normalized) return false;

  return !Number.isNaN(
    new Date(normalized).getTime(),
  );
}

function isValidTimezone(value) {
  if (typeof value !== "string") return false;

  const normalized = value.trim();

  if (!normalized || normalized.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: normalized,
    }).format();

    return true;
  } catch {
    return false;
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;

    let body;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const orgAuth =
      await requireOrgForScheduledBroadcast(id);

    if (orgAuth.error) return orgAuth.error;

    if (
      !MUTABLE_STATUSES.has(
        String(orgAuth.broadcast.status),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only queued broadcasts can be updated.",
        },
        { status: 409 },
      );
    }

    const patch = cleanPatch(
      body,
      ALLOWED_PATCH_FIELDS,
    );

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        "status",
      )
    ) {
      if (
        typeof patch.status !== "string" ||
        !ALLOWED_MANUAL_STATUSES.has(
          patch.status,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid manual status update.",
          },
          { status: 400 },
        );
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        "scheduled_for",
      ) &&
      !isValidDate(patch.scheduled_for)
    ) {
      return NextResponse.json(
        { error: "Invalid scheduled_for" },
        { status: 400 },
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        "timezone",
      ) &&
      !isValidTimezone(patch.timezone)
    ) {
      return NextResponse.json(
        { error: "Invalid timezone" },
        { status: 400 },
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid fields provided to update.",
        },
        { status: 400 },
      );
    }

    const data = await updateScheduledBroadcast(
      orgAuth.broadcastId,
      patch,
    );

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.BROADCAST_SCHEDULE_UPDATED,
      entityType: "scheduled_broadcast",
      entityId: orgAuth.broadcastId,
      details: {
        fields: Object.keys(patch),
        status: patch.status ?? null,
        scheduledFor: patch.scheduled_for ?? null,
        channel: data?.channel ?? null,
      },
    });

    return NextResponse.json({
      item: data,
    });
  } catch (err) {
    return handleApiError(
      err,
      "Failed to update scheduled broadcast",
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;

    const orgAuth =
      await requireOrgForScheduledBroadcast(id);

    if (orgAuth.error) return orgAuth.error;

    if (
      !DELETABLE_STATUSES.has(
        String(orgAuth.broadcast.status),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only queued or cancelled broadcasts can be deleted.",
        },
        { status: 409 },
      );
    }

    await deleteScheduledBroadcast(
      orgAuth.broadcastId,
    );

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.BROADCAST_SCHEDULE_DELETED,
      entityType: "scheduled_broadcast",
      entityId: orgAuth.broadcastId,
      details: {
        status: orgAuth.broadcast?.status ?? null,
        scheduledFor: orgAuth.broadcast?.scheduled_for ?? null,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    return handleApiError(
      err,
      "Failed to delete scheduled broadcast",
    );
  }
}