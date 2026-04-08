import { NextResponse } from "next/server";
import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await sendTeamsBroadcast(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Teams broadcast error:", err);

    return NextResponse.json(
      { error: err.message || String(err) },
      { status: err.status || 500 },
    );
  }
}
