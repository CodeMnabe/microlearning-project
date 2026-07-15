import { NextResponse } from "next/server";
import { getMessagesInThread } from "@/lib/repos/messages.repo";
import {
  handleApiError,
  requireOrgForThread,
} from "@/lib/auth/guards";

export async function GET(_req, { params }) {
  try {
    const { threadId: rawThreadId } = await params;
    const threadId = Number(rawThreadId);

    const orgAuth = await requireOrgForThread(threadId);
    if (orgAuth.error) return orgAuth.error;

    const messages = await getMessagesInThread(orgAuth.threadId);

    return NextResponse.json({ messages });
  } catch (err) {
    return handleApiError(err, "Failed to load thread messages");
  }
}