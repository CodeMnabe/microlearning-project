export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createReadChain } from "@/lib/services/broadcast/readChains/createReadChain.service";
import { BroadcastError } from "@/lib/services/broadcast/shared";

/**
 * HTTP entry point for creating Read Chains.
 *
 * Reads the request and translates service results/errors into HTTP responses.
 * Validation, persistence and sending are coordinated by createReadChain.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const result = await createReadChain(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[broadcast/read-chain] failed:", error);

    return NextResponse.json(
      { error: error.message || "Failed to create read chain." },
      { status: error instanceof BroadcastError ? error.status : 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    route: "/api/broadcast/read-chain",
  });
}
