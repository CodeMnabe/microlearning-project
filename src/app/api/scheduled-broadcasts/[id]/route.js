import { NextResponse } from "next/server";
import {
  updateScheduledBroadcast,
  deleteScheduledBroadcast,
} from "@/lib/repos/scheduledBroadcasts.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PATCH_FIELDS = [
  "channel",
  "scheduled_for",
  "timezone",
  "status",
  "payload",
  "recipient_count",
];

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const patch = Object.fromEntries(
      Object.entries(body || {}).filter(([key]) =>
        ALLOWED_PATCH_FIELDS.includes(key),
      ),
    );

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided to update." },
        { status: 400 },
      );
    }

    const data = await updateScheduledBroadcast(id, patch);
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("PATCH error:", err);

    return NextResponse.json(
      { error: "Failed to update scheduled broadcast." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteScheduledBroadcast(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE error:", err);

    return NextResponse.json(
      { error: "Failed to delete scheduled broadcast" },
      { status: 500 },
    );
  }
}
