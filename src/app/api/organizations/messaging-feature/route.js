export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getOrCreateOrganizationMessagingFeature,
  setReadChainsEnabled,
} from "@/lib/repos/organizationMessagingFeature.repo";

function getOrgIdFromUrl(req) {
  const value = req.nextUrl.searchParams.get("orgId");
  const orgId = Number(value);

  return Number.isFinite(orgId) && orgId > 0 ? orgId : null;
}

function getChannelFromUrl(req) {
  return req.nextUrl.searchParams.get("channel") || "whatsapp";
}

export async function GET(req) {
  try {
    const orgId = getOrgIdFromUrl(req);
    const channel = getChannelFromUrl(req);

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const feature = await getOrCreateOrganizationMessagingFeature({
      organizationId: orgId,
      channel,
    });

    return NextResponse.json({
      ok: true,
      item: feature,
    });
  } catch (error) {
    console.error("[messaging-feature] GET failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to load messaging feature.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const orgId = Number(body.organizationId ?? body.orgId);
    const channel = body.channel || "whatsapp";

    if (!Number.isFinite(orgId) || orgId <= 0) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    if (typeof body.readChainsEnabled !== "boolean") {
      return NextResponse.json(
        { error: "readChainsEnabled must be a boolean" },
        { status: 400 },
      );
    }

    const feature = await setReadChainsEnabled({
      organizationId: orgId,
      channel,
      enabled: body.readChainsEnabled,
    });

    return NextResponse.json({
      ok: true,
      item: feature,
    });
  } catch (error) {
    console.error("[messaging-feature] PATCH failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to update messaging feature.",
      },
      { status: 500 },
    );
  }
}
