import { NextResponse } from "next/server";
import {
  getTrackedLinkById,
  getTrackedLinkByToken,
  recordTrackedLinkInteraction,
} from "@/lib/repos/trackedLinks.repo";
import { validateTrackedLinkDestination } from "@/lib/services/broadcast/trackedLinkUrl";
import { logger } from "@/lib/observability/logger";
import { deriveClientIdentity } from "@/lib/security/clientIdentity";
import { deriveOpaqueIdentifier } from "@/lib/security/opaqueIdentity";
import { consumeCapacitySet } from "@/lib/repos/requestCapacity.repo";
import {
  TRACKED_LINK_DEDUPE_WINDOW_SECONDS,
  TRACKED_LINK_RATE_LIMITS,
} from "@/lib/limits/publicAbuse";
import {
  classifyTrackedLinkClient,
  createTrackedLinkContext,
  normalizeAllowedRefererOrigin,
  verifyTrackedLinkContext,
} from "@/lib/services/broadcast/trackedLinkInteraction";
import { readBoundedJson, RequestBodyError } from "@/lib/http/boundedJson";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;
const PUBLIC_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

function unavailable() {
  return NextResponse.json(
    { error: "Link unavailable" },
    { status: 404, headers: PUBLIC_HEADERS },
  );
}

function isActiveLink(link, now = Date.now()) {
  if (!link || link.revoked_at || !link.expires_at) return false;
  const expiry = Date.parse(link.expires_at);
  return Number.isFinite(expiry) && expiry > now;
}

async function getResolutionCapacity(tokenHash, visitorHash) {
  const globalHash = deriveOpaqueIdentifier("tracked-link-global", "all");
  return consumeCapacitySet([
    {
      scope: "tracked-link-probing-global",
      subjectHash: globalHash,
      ...TRACKED_LINK_RATE_LIMITS.probingGlobal,
    },
    {
      scope: "tracked-link-token",
      subjectHash: tokenHash,
      ...TRACKED_LINK_RATE_LIMITS.token,
    },
    {
      scope: "tracked-link-visitor",
      subjectHash: visitorHash,
      ...TRACKED_LINK_RATE_LIMITS.visitor,
    },
  ]);
}

async function resolveRequest(request, params) {
  const resolvedParams = await params;
  const token = String(resolvedParams?.token || "").trim();
  if (!TOKEN_PATTERN.test(token)) return null;

  const tokenHash = deriveOpaqueIdentifier("tracked-link-token", token);
  const { subjectHash: visitorHash } = deriveClientIdentity(
    request,
    "tracked-link-visitor",
  );
  const capacity = await getResolutionCapacity(tokenHash, visitorHash);
  if (!capacity.accepted) {
    return {
      rateLimited: true,
      retryAfterSeconds: capacity.retryAfterSeconds,
    };
  }
  const trackedLink = await getTrackedLinkByToken(token);
  if (!isActiveLink(trackedLink)) return null;

  let destinationUrl;
  try {
    destinationUrl = validateTrackedLinkDestination(trackedLink.destination_url);
  } catch {
    return null;
  }
  return { trackedLink, destinationUrl, tokenHash, visitorHash, capacity };
}

export async function HEAD(request, { params }) {
  try {
    const resolvedParams = await params;
    const token = String(resolvedParams?.token || "").trim();
    if (!TOKEN_PATTERN.test(token)) return new Response(null, { status: 404 });
    const link = await getTrackedLinkByToken(token);
    if (!isActiveLink(link)) return new Response(null, { status: 404 });
    try {
      validateTrackedLinkDestination(link.destination_url);
    } catch {
      return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 200, headers: PUBLIC_HEADERS });
  } catch {
    return new Response(null, { status: 503, headers: PUBLIC_HEADERS });
  }
}

export async function GET(request, { params }) {
  try {
    const resolved = await resolveRequest(request, params);
    if (!resolved) return unavailable();
    if (resolved.rateLimited) {
      return NextResponse.json(
        { error: "Link unavailable" },
        {
          status: 429,
          headers: {
            ...PUBLIC_HEADERS,
            "Retry-After": String(resolved.retryAfterSeconds),
          },
        },
      );
    }
    const clientClassification = classifyTrackedLinkClient(request);
    const analyticsAllowed =
      clientClassification === "browser";
    const interactionContext = analyticsAllowed
      ? createTrackedLinkContext({
          trackedLinkId: resolved.trackedLink.id,
          visitorHash: resolved.visitorHash,
          tokenHash: resolved.tokenHash,
          recipientUserId: resolved.trackedLink.recipient_user_id,
          clientClassification,
        })
      : null;
    return NextResponse.json(
      {
        ok: true,
        destinationUrl: resolved.destinationUrl,
        linkLabel: resolved.trackedLink.link_label,
        interactionContext,
      },
      { headers: PUBLIC_HEADERS },
    );
  } catch (error) {
    logger.error(
      "tracked_link_resolution_failed",
      {
        provider: "internal",
        operation: "tracked_link_resolve",
        outcome: "failed",
      },
      error,
    );
    return NextResponse.json(
      { error: "Link unavailable" },
      { status: 503, headers: PUBLIC_HEADERS },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const body = await readBoundedJson(request, 4096);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.interactionContext !== "string"
    ) {
      return unavailable();
    }
    const context = verifyTrackedLinkContext(body.interactionContext);
    const resolvedParams = await params;
    const token = String(resolvedParams?.token || "").trim();
    if (!context || !TOKEN_PATTERN.test(token)) return unavailable();

    const tokenHash = deriveOpaqueIdentifier("tracked-link-token", token);
    const { subjectHash: visitorHash } = deriveClientIdentity(
      request,
      "tracked-link-visitor",
    );
    if (
      tokenHash !== context.tokenHash ||
      visitorHash !== context.visitorHash ||
      classifyTrackedLinkClient(request) !== "browser" ||
      context.clientClassification !== "browser"
    ) {
      return NextResponse.json({ ok: true }, { status: 202, headers: PUBLIC_HEADERS });
    }

    const link = await getTrackedLinkById(context.trackedLinkId);
    if (!isActiveLink(link)) return unavailable();
    if ((link.recipient_user_id ?? null) !== context.recipientUserId) {
      return unavailable();
    }

    await recordTrackedLinkInteraction({
      trackedLinkId: context.trackedLinkId,
      visitorHash,
      tokenHash,
      recipientUserId: link.recipient_user_id,
      clientClassification: "browser",
      refererOrigin: normalizeAllowedRefererOrigin(request),
      dedupeWindowSeconds: TRACKED_LINK_DEDUPE_WINDOW_SECONDS,
      globalLimit: TRACKED_LINK_RATE_LIMITS.analyticsGlobal,
      tokenLimit: TRACKED_LINK_RATE_LIMITS.analyticsToken,
      visitorLimit: TRACKED_LINK_RATE_LIMITS.analyticsVisitor,
    });
    return NextResponse.json({ ok: true }, { status: 202, headers: PUBLIC_HEADERS });
  } catch (error) {
    if (error instanceof RequestBodyError) return unavailable();
    logger.error(
      "tracked_link_resolution_failed",
      {
        provider: "internal",
        operation: "tracked_link_interaction",
        outcome: "failed",
      },
      error,
    );
    return NextResponse.json({ ok: true }, { status: 202, headers: PUBLIC_HEADERS });
  }
}
