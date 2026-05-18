import { NextResponse } from "next/server";
import {
  createAutomationRule,
  getOrgAutomationRules,
} from "@/lib/repos/automationRules.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const items = await getOrgAutomationRules(orgId);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const row = await createAutomationRule({
      organization_id: Number(body.organization_id),
      name: body.name,
      trigger_type: body.trigger_type,
      assistant_id: body.assistant_id ?? null,
      channel: body.channel,
      delay_minutes: Number(body.delay_minutes || 0),
      payload: body.payload || {},
      is_active: body.is_active ?? true,
      whatsapp_template_id: body.whatsapp_template_id ?? null,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
