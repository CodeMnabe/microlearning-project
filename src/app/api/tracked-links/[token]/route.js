import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getTrackedLinkByToken,
  createTrackedLinkEvent,
} from "@/lib/repos/trackedLinks.repo";
import { validateTrackedLinkDestination } from "@/lib/services/broadcast/trackedLinkUrl";
import { logger } from "@/lib/observability/logger";

function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "";
}

function hashIp(ip = "") {
  if (!ip) return null;

  const salt = process.env.TRACKED_LINK_IP_SALT || "tracked-link-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const token = String(resolvedParams?.token || "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const trackedLink = await getTrackedLinkByToken(token);

    if (!trackedLink) {
      return NextResponse.json(
        { error: "Tracked link not found" },
        { status: 400 },
      );
    }

    let destinationUrl;
    try {
      destinationUrl = validateTrackedLinkDestination(
        trackedLink.destination_url,
      );
    } catch {
      return NextResponse.json(
        { error: "Tracked link destination is invalid" },
        { status: 400 },
      );
    }

    const userAgent = req.headers.get("user-agent") || null;
    const referer = req.headers.get("referer") || null;
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    await createTrackedLinkEvent({
      tracked_link_id: trackedLink.id,
      event_type: "click",
      ip_hash: ipHash,
      user_agent: userAgent,
      referer,
    });

    return NextResponse.json({
      ok: true,
      destinationUrl,
      linkLabel: trackedLink.link_label,
    });
  } catch (err) {
    logger.error(
      "tracked_link_resolution_failed",
      {
        provider: "internal",
        operation: "tracked_link_resolve",
        outcome: "failed",
      },
      err,
    );
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 },
    );
  }
}
