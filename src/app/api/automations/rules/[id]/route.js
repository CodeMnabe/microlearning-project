import { NextResponse } from "next/server";
import {
  deleteAutomationRule,
  updateAutomationRule,
} from "@/lib/repos/automationRules.repo";

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const patch = {};

    if (body.name !== undefined) patch.name = body.name;
    if (body.trigger_type !== undefined) patch.trigger_type = body.trigger_type;
    if (body.assistant_id !== undefined) patch.assistant_id = body.assistant_id;
    if (body.channel !== undefined) patch.channel = body.channel;
    if (body.delay_minutes !== undefined) {
      patch.delay_minutes = Number(body.delay_minutes || 0);
    }
    if (body.payload !== undefined) patch.payload = body.payload;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.whatsapp_template_id !== undefined) {
      patch.whatsapp_template_id = body.whatsapp_template_id || null;
    }

    const updated = await updateAutomationRule(id, patch);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    await deleteAutomationRule(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
