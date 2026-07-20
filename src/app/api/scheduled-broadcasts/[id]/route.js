import { NextResponse } from "next/server";
import {
  cancelScheduledBroadcast,
  editScheduledBroadcast,
  toBrowserScheduledBroadcast,
} from "@/lib/repos/scheduledBroadcasts.repo";
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
  "expected_updated_at",
];

function isValidDate(value) {
  if (typeof value !== "string") return false;

  const normalized = value.trim();

  if (!normalized) return false;

  return !Number.isNaN(new Date(normalized).getTime());
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
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const orgAuth = await requireOrgForScheduledBroadcast(id);

    if (orgAuth.error) return orgAuth.error;

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      if (body.status !== "cancelled") {
        return NextResponse.json(
          { error: "Status changes are not supported by PATCH." },
          { status: 400 },
        );
      }

      const cancelled = await cancelScheduledBroadcast({
        id: orgAuth.broadcastId,
        organizationId: orgAuth.orgId,
        cancelledByUserId: orgAuth.user.id,
      });

      if (!cancelled) {
        return NextResponse.json(
          { error: "Broadcast state changed; it can no longer be cancelled." },
          { status: 409 },
        );
      }

      return NextResponse.json({
        item: toBrowserScheduledBroadcast(cancelled),
      });
    }

    const patch = cleanPatch(body, ALLOWED_PATCH_FIELDS);

    if (
      Object.prototype.hasOwnProperty.call(patch, "scheduled_for") &&
      !isValidDate(patch.scheduled_for)
    ) {
      return NextResponse.json(
        { error: "Invalid scheduled_for" },
        { status: 400 },
      );
    }

    if (!isValidDate(patch.expected_updated_at)) {
      return NextResponse.json(
        { error: "expected_updated_at is required" },
        { status: 400 },
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(patch, "timezone") &&
      !isValidTimezone(patch.timezone)
    ) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    if (
      !Object.prototype.hasOwnProperty.call(patch, "scheduled_for") &&
      !Object.prototype.hasOwnProperty.call(patch, "timezone")
    ) {
      return NextResponse.json(
        {
          error: "No valid fields provided to update.",
        },
        { status: 400 },
      );
    }

    const data = await editScheduledBroadcast({
      id: orgAuth.broadcastId,
      organizationId: orgAuth.orgId,
      actorUserId: orgAuth.user.id,
      scheduledFor: patch.scheduled_for ?? null,
      timezone: patch.timezone ?? null,
      expectedUpdatedAt: patch.expected_updated_at,
    });

    if (!data) {
      return NextResponse.json(
        { error: "Broadcast state changed; refresh and try again." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      item: toBrowserScheduledBroadcast(data),
    });
  } catch (err) {
    return handleApiError(err, "Failed to update scheduled broadcast");
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;

    const orgAuth = await requireOrgForScheduledBroadcast(id);

    if (orgAuth.error) return orgAuth.error;

    const cancelled = await cancelScheduledBroadcast({
      id: orgAuth.broadcastId,
      organizationId: orgAuth.orgId,
      cancelledByUserId: orgAuth.user.id,
      reason: "Cancelled from scheduled broadcasts UI",
    });

    if (!cancelled) {
      return NextResponse.json(
        { error: "Broadcast state changed; it cannot be removed." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      item: toBrowserScheduledBroadcast(cancelled),
    });
  } catch (err) {
    return handleApiError(err, "Failed to delete scheduled broadcast");
  }
}
