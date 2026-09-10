import { NextResponse } from "next/server";
import {
  handleApiError,
  requireOwnedOrg,
  requireUser,
} from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";

async function getOrgById(admin, orgId) {
  const { data, error } = await admin
    .from("organization")
    .select("id, waba_id, waba_namespace, channel_id")
    .eq("id", orgId)
    .single();

  if (error) throw error;
  return data;
}

export async function POST(req) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const body = await req.json();

    const {
      orgId,
      name,
      language = "pt",
      category = "MARKETING",
      components,
    } = body || {};

    const orgAuth = await requireOwnedOrg(orgId, auth);
    if (orgAuth.error) return orgAuth.error;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Array.isArray(components) ||
      components.length === 0
    ) {
      return NextResponse.json(
        { error: "name and components are required" },
        { status: 400 },
      );
    }

    if (
      typeof language !== "string" ||
      !language.trim() ||
      typeof category !== "string" ||
      !category.trim()
    ) {
      return NextResponse.json(
        { error: "Invalid language or category" },
        { status: 400 },
      );
    }

    const org = await getOrgById(orgAuth.admin, orgAuth.orgId);

    const mb = await fetch(
      "https://integrations.messagebird.com/v2/platforms/whatsapp/templates",
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          language: language.trim(),
          category: category.trim(),
          wabaId: org.waba_id,
          components,
        }),
      },
    );

    const mbData = await mb.json();

    if (!mb.ok) {
      return NextResponse.json({ error: mbData }, { status: mb.status });
    }

    const { data: template, error } = await orgAuth.admin
      .from("whatsapp_templates")
      .insert({
        org_id: orgAuth.orgId,
        name: name.trim(),
        language: language.trim(),
        category: category.trim(),
        status: mbData.status ?? "NEW",
        components,
        provider_template_id: mbData.id ?? null,
        waba_id: org.waba_id,
        namespace: org.waba_namespace || null,
      })
      .select()
      .single();

    if (error) throw error;

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.TEMPLATE_CREATED,
      entityType: "whatsapp_template",
      entityId: template?.id,
      entityLabel: template?.name ?? name.trim(),
      details: {
        language: language.trim(),
        category: category.trim(),
        status: template?.status ?? null,
      },
    });

    return NextResponse.json(
      { ok: true, template },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, "Failed to create WhatsApp template");
  }
}