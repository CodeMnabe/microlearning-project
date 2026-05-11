import { NextResponse } from "next/server";
import { getOrganization } from "@/lib/repos/organizations.repo";
import { createScheduledBroadcast } from "@/lib/repos/scheduledBroadcasts.repo";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      orgId,
      createdByUserId = null,
      channel,
      scheduledFor,
      timezone,
      payload,
      recipientCount = 0,
    } = body;

    if (!orgId || !channel || !scheduledFor || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["teams", "whatsapp"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledFor date" },
        { status: 400 },
      );
    }

    if (when.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Scheduled date must be in the future" },
        { status: 400 },
      );
    }

    const org = await getOrganization(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 },
      );
    }

    // Do NOT store createdByUserId inside payload.
    // Keep it only in created_by_user_id column.
    const cleanPayload = {
      ...payload,
    };

    const row = await createScheduledBroadcast({
      organization_id: orgId,
      created_by_user_id: createdByUserId,
      channel,
      status: "queued",
      scheduled_for: when.toISOString(),
      timezone: timezone || null,
      payload: cleanPayload,
      recipient_count: Number(recipientCount || 0),
    });

    return NextResponse.json({ ok: true, item: row });
  } catch (err) {
    console.error("Schedule broadcast error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
