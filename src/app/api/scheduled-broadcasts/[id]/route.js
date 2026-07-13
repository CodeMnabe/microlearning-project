import { NextResponse } from "next/server";
import {
  deleteScheduledBroadcast,
  updateScheduledBroadcast,
} from "@/lib/services/broadcast/scheduledBroadcasts/scheduledBroadcasts.service";
import { BroadcastError } from "@/lib/services/broadcast/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const item = await updateScheduledBroadcast({
      id,
      body: await req.json(),
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("PATCH error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof BroadcastError
            ? error.message
            : "Failed to update scheduled broadcast.",
      },
      { status: error instanceof BroadcastError ? error.status : 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteScheduledBroadcast({ id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled broadcast" },
      { status: 500 }
    );
  }
}
