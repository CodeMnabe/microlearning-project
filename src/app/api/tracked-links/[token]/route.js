import { NextResponse } from "next/server";
import {
  getTrackedLinkClientIp,
  hashTrackedLinkIp,
  normalizeTrackedLinkToken,
} from "@/lib/services/broadcast/trackedLink.helpers";
import { resolveTrackedLinkClick } from "@/lib/services/broadcast/trackedLinks";

/** Resolves a public tracked-link token and returns its destination data. */
export async function GET(req, { params }) {
  try {
    const token = normalizeTrackedLinkToken((await params)?.token);

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const ip = getTrackedLinkClientIp(req.headers);
    const trackedLink = await resolveTrackedLinkClick({
      token,
      ipHash: hashTrackedLinkIp(ip, process.env.TRACKED_LINK_IP_SALT),
      userAgent: req.headers.get("user-agent") || null,
      referer: req.headers.get("referer") || null,
    });

    if (!trackedLink) {
      return NextResponse.json(
        { error: "Tracked link not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, ...trackedLink });
  } catch (error) {
    console.error("Tracked link resolve error:", error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
