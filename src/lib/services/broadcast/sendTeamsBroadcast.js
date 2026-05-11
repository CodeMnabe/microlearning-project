import { getBotToken } from "@/lib/teams/auth";
import { getOrganization } from "@/lib/repos/organizations.repo";
import { getTeamsUserInstallation } from "@/lib/repos/teamsInstallations.repo";
import {
  BroadcastError,
  normalizeFiles,
  isImageType,
  isVideoType,
} from "./shared";
import {
  replaceTrackedPlaceholders,
  resolveTrackedLinksForRecipient,
} from "./trackedLinks";

export async function sendTeamsBroadcast(input = {}) {
  const {
    orgId,
    userIds = [],
    message = "",
    files = [],
    imageUrls = [],
    trackedLinks = [],
    scheduledBroadcastId = null,
    createdByUserId = null,
  } = input;

  if (!orgId || !Array.isArray(userIds) || userIds.length === 0) {
    throw new BroadcastError("Missing orgId or userIds", 400);
  }

  const normalizedFiles = normalizeFiles({ files, imageUrls });

  if (!String(message || "").trim() && normalizedFiles.length === 0) {
    throw new BroadcastError("Message or files must be provided", 400);
  }

  const org = await getOrganization(orgId);
  if (!org) {
    throw new BroadcastError("Organization not found", 400);
  }

  const results = [];

  for (const userId of userIds) {
    const install = await getTeamsUserInstallation({
      userId,
      conversationType: "personal",
    });

    if (
      !install ||
      !install?.tenant_id ||
      !install?.service_url ||
      !install?.conversation_id
    ) {
      results.push({
        userId,
        ok: false,
        error: "No Teams installation found for this user (personal).",
      });
      continue;
    }

    try {
      const token = await getBotToken(install.tenant_id);

      const endpoint = `${String(install.service_url).replace(/\/$/, "")}/v3/conversations/${install.conversation_id}/activities`;

      const imageFiles = normalizedFiles.filter((f) =>
        isImageType(f.contentType),
      );

      const videoFiles = normalizedFiles.filter((f) =>
        isVideoType(f.contentType),
      );

      const otherFiles = normalizedFiles.filter(
        (f) => !isImageType(f.contentType) && !isVideoType(f.contentType),
      );

      const imageAttachments = imageFiles.map((f) => ({
        contentType: f.contentType || "image/png",
        contentUrl: f.url,
        name: f.name || "image",
      }));

      const videoCardAttachments = videoFiles.map((f) => {
        const hasThumb = Boolean(f.thumbnailUrl);

        return {
          contentType: "application/vnd.microsoft.card.hero",
          content: {
            title: f.name || "Video",
            ...(hasThumb ? { images: [{ url: f.thumbnailUrl }] } : {}),
            buttons: [{ type: "openUrl", title: "▶ Ver vídeo", value: f.url }],
          },
        };
      });

      const resolvedTrackedLinks = await resolveTrackedLinksForRecipient({
        trackedLinks,
        orgId,
        channel: "teams",
        recipientUserId: userId,
        scheduledBroadcastId,
        createdByUserId,
      });

      let text = replaceTrackedPlaceholders(
        message,
        resolvedTrackedLinks,
      ).trim();

      if (otherFiles.length) {
        const links = otherFiles
          .map((f) => `[${f.name || "file"}](${f.url})`)
          .join("\n");

        text = [text, links].filter(Boolean).join("\n\n");
      }

      if (!text) text = " ";

      console.log("[Teams final message]", {
        userId,
        text,
        resolvedTrackedLinks,
      });

      const payload = {
        type: "message",
        text,
        textFormat: "markdown",
        attachments: [...imageAttachments, ...videoCardAttachments],
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }

      results.push({
        userId,
        ok: res.ok,
        status: res.status,
        data,
      });
    } catch (err) {
      results.push({
        userId,
        ok: false,
        error: err.message || String(err),
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - okCount;

  return {
    ok: okCount,
    failed: failedCount,
    results,
    error:
      okCount === 0
        ? results[0]?.error ||
          results[0]?.data?.error ||
          "Teams broadcast failed for all recipients."
        : null,
  };
}
