export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getMessageById } from "@/lib/repos/messages.repo";
import { processReadChainAfterRead } from "@/lib/services/broadcast/readChains/processReadChainAfterRead";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

export async function POST(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { messageDbId } = body;

    if (!messageDbId) {
      return NextResponse.json(
        { error: "messageDbId is required" },
        { status: 400 },
      );
    }

    const message = await getMessageById(messageDbId);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (!message.message_chain_id) {
      return NextResponse.json(
        { error: "Message is not part of a read chain" },
        { status: 400 },
      );
    }

    if (!message.read_at) {
      return NextResponse.json(
        {
          error:
            "Message is not marked as read yet. Use sync-read-receipts first or wait for Bird/prod webhook.",
        },
        { status: 400 },
      );
    }

    const result = await processReadChainAfterRead(message);

    return NextResponse.json({
      ok: true,
      messageDbId,
      chainId: message.message_chain_id,
      stepIndex: message.message_chain_step_index,
      result,
    });
  } catch (error) {
    console.error("[read-chain/process-read] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to process read chain message.",
      },
      { status: 500 },
    );
  }
}
