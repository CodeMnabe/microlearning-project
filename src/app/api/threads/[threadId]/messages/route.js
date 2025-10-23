// app/api/threads/[threadId]/messages/route.js
import { NextResponse } from "next/server";
import { getMessagesInThread } from "@/lib/repos/messages.repo";

export async function GET(req, { params }) {
  try {
    const threadId = Number(params.threadId);
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }
    const messages = await getMessagesInThread(threadId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("GET /api/threads/[threadId]/messages error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
