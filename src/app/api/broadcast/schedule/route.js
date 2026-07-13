import { NextResponse } from "next/server";
import { createScheduledBroadcast } from "@/lib/services/broadcast/scheduledBroadcasts/scheduledBroadcasts.service";
import { BroadcastError } from "@/lib/services/broadcast/shared";

/** HTTP entry point for scheduling a Broadcast. */
export async function POST(req) {
  try {
    const item = await createScheduledBroadcast(await req.json());

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("Schedule broadcast error:", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: error instanceof BroadcastError ? error.status : 500 }
    );
  }
}
