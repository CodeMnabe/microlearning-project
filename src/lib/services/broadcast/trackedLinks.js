import { createTrackedLink } from "@/lib/repos/trackedLinks.repo";
import crypto from "crypto";

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
}) {
  const token = makeToken();

  const trackedLink = await createTrackedLink({
    org_id: orgId,
    channel,
    recipient_user_id: recipientUserId,
    scheduled_broadcast_id: scheduledBroadcastId,
    send_group_id: sendGroupId,
    destination_url: destinationUrl,
    link_label: linkLabel,
    token,
    link_key: linkKey,
    source_type: "broadcast",
    created_by_user_id: createdByUserId,
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
}) {
  const resolved = [];

  for (const link of trackedLinks) {
    const key = String(link?.key || "").trim();
    const label = String(link?.label || "").trim();
    const destinationUrl = String(link?.destinationUrl || "").trim();

    if (!key || !label || !destinationUrl) continue;

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