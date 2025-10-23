// app/api/messages/route.js
import { NextResponse } from "next/server";
import { getMessagesInThread } from "@/lib/repos/messages.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = Number(searchParams.get("threadId"));
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const messages = await getMessagesInThread(threadId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
