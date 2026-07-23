import { createTrackedLink } from "@/lib/repos/trackedLinks.repo";
import crypto from "crypto";
import {
  validateTrackedLinkDestination,
  validateTrackedLinks,
} from "./trackedLinkUrl";
import { TRACKED_LINK_HARD_MAX_TTL_SECONDS } from "@/lib/limits/publicAbuse";

function makeToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function getAppBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (!base) {
    throw new Error(
      "Missing app base URL. Set NEXT_PUBLIC_APP_URL or APP_URL.",
    );
  }

  return String(base).replace(/\/$/, "");
}

function getTrackedLinkExpiry() {
  const ttlSeconds = Number(process.env.TRACKED_LINK_TTL_SECONDS);
  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > TRACKED_LINK_HARD_MAX_TTL_SECONDS
  ) {
    throw new Error("TRACKED_LINK_TTL_SECONDS is missing or invalid");
  }
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export function replaceTrackedPlaceholders(message = "", resolvedLinks = []) {
  let out = String(message || "");

  for (const link of resolvedLinks) {
    const placeholder = `{{link.${link.key}}}`;
    out = out.split(placeholder).join(link.trackedUrl);
  }

  return out;
}

export async function createTrackedLinkForRecipient({
  orgId,
  channel,
  recipientUserId = null,
  scheduledBroadcastId = null,
  sendGroupId = null,
  destinationUrl,
  linkLabel,
  linkKey = null,
  createdByUserId = null,
  immediateBroadcastDeliveryId = null,
}) {
  const safeDestinationUrl = validateTrackedLinkDestination(destinationUrl);
  const token = makeToken();

  const trackedLink = await createTrackedLink({
    org_id: orgId,
    channel,
    recipient_user_id: recipientUserId,
    scheduled_broadcast_id: scheduledBroadcastId,
    send_group_id: sendGroupId,
    destination_url: safeDestinationUrl,
    link_label: linkLabel,
    token,
    link_key: linkKey,
    source_type: "broadcast",
    created_by_user_id: createdByUserId,
    immediate_broadcast_delivery_id: immediateBroadcastDeliveryId,
    expires_at: getTrackedLinkExpiry(),
  });

  return {
    row: trackedLink,
    trackedUrl: `${getAppBaseUrl()}/r/${token}`,
  };
}

export async function resolveTrackedLinksForRecipient({
  trackedLinks = [],
  orgId,
  channel,
  recipientUserId = null,
  scheduledBroadcastId = null,
  sendGroupId = null,
  createdByUserId = null,
  immediateBroadcastDeliveryId = null,
}) {
  const resolved = [];
  const validatedTrackedLinks = validateTrackedLinks(trackedLinks);

  for (const link of validatedTrackedLinks) {
    const key = String(link?.key || "").trim();
    const label = String(link?.label || "").trim();
    const destinationUrl = link.destinationUrl;

    if (!key || !label) continue;

    const { trackedUrl } = await createTrackedLinkForRecipient({
      orgId,
      channel,
      recipientUserId,
      scheduledBroadcastId,
      sendGroupId,
      destinationUrl,
      linkLabel: label,
      linkKey: key,
      createdByUserId,
      immediateBroadcastDeliveryId,
    });

    resolved.push({
      key,
      label,
      destinationUrl,
      trackedUrl,
    });
  }

  return resolved;
}
