import { NextResponse } from "next/server";

import { getMessagesInThread } from "@/lib/repos/messages.repo";

import { handleApiError, requireOrgForThread } from "@/lib/auth/guards";

export async function GET(_req, { params }) {
  try {
    /*
     * Next.js 16:
     * params is asynchronous.
     */
    const { threadId } = await params;

    const orgAuth = await requireOrgForThread(threadId);

    if (orgAuth.error) {
      return orgAuth.error;
    }

    const messages = await getMessagesInThread(orgAuth.threadId);

    return NextResponse.json(
      {
        messages,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    return handleApiError(err, "Failed to load thread messages");
  }
}
