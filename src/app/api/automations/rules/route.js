import { NextResponse } from "next/server";

import {
  createAutomationRuleFromInput,
  listAutomationRules,
} from "@/lib/services/automations/automationRules.service";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = Number(
      searchParams.get("orgId"),
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
      await listAutomationRules({
        organizationId: orgId,
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

export async function POST(req) {
  try {
    const body = await req.json();

    const organizationId = Number(
      body.organization_id,
    );

    const triggerType =
      body.trigger_type;

    const channel = body.channel;

    if (
      !organizationId ||
      !body.name ||
      !triggerType ||
      !channel
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: organization_id, name, trigger_type, channel",
        },
        {
          status: 400,
        },
      );
    }

    const row =
      await createAutomationRuleFromInput(
        body,
      );

    return NextResponse.json(row, {
      status: 201,
    });
  } catch (error) {
    const status =
      error?.status ||
      (error?.code ===
      "INACTIVITY_RULE_CONFLICT"
        ? 409
        : 500);

    return NextResponse.json(
      {
        error:
          error?.message ||
          String(error),
      },
      {
        status,
      },
    );
  }
}