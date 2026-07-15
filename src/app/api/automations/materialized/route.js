import { NextResponse } from "next/server";

import {
  listMaterializedAutomationRuns,
} from "@/lib/services/automations/automationRuns.service";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = Number(
      searchParams.get("orgId"),
    );

    const limit = Math.min(
      500,
      Math.max(
        1,
        Number(
          searchParams.get("limit") || 100,
        ),
      ),
    );

    if (!orgId) {
      return NextResponse.json(
        {
          error: "Missing orgId",
        },
        {
          status: 400,
        },
      );
    }

    const items =
      await listMaterializedAutomationRuns({
        organizationId: orgId,
        limit,
      });

    return NextResponse.json({
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          String(error),
      },
      {
        status: 500,
      },
    );
  }
}