import { NextResponse } from "next/server";

import {
  removeAutomationRule,
  updateAutomationRuleFromInput,
} from "@/lib/services/automations/automationRules.service";

export async function PATCH(
  req,
  { params },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated =
      await updateAutomationRuleFromInput({
        id,
        body,
      });

    if (!updated) {
      return NextResponse.json(
        {
          error: "Rule not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(updated);
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

export async function DELETE(
  _req,
  { params },
) {
  try {
    const { id } = await params;

    await removeAutomationRule({
      id,
    });

    return NextResponse.json({
      ok: true,
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
