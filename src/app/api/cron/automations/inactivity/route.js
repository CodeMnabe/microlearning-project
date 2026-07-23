import { NextResponse } from "next/server";
import { processInactivityRulesGlobally } from "@/lib/services/automations/processInactivityRules";
import { logger } from "@/lib/observability/logger";

export const maxDuration = 300;

export async function POST(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || (authHeader !== `Bearer ${cronSecret}` && xCronSecret !== cronSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await processInactivityRulesGlobally();

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "automation_inactivity_processing_failed",
      {
        provider: "internal",
        operation: "automation_inactivity_batch",
        outcome: "failed",
      },
      error,
    );

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  return POST(req);
}
