export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getPendingWhatsappMessagesForReadReceiptSync,
  markMessageRead,
} from "@/lib/repos/messages.repo";
import { getOrganizationBirdConfig } from "@/lib/repos/organizations.repo";
import { processReadChainAfterRead } from "@/lib/services/broadcast/readChains/processReadChainAfterRead";
import { parsePositiveInt } from "@/lib/auth/guards";

const BIRD = "https://api.bird.com";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

function parseUuid(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  const isValidUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    );

  return isValidUuid ? normalized : null;
}

function getBirdBaseConfig() {
  const apiKey = process.env.BIRD_API_KEY;
  const workspaceId = process.env.WORKSPACE_ID;

  if (!apiKey) {
    throw new Error("Missing BIRD_API_KEY");
  }

  if (!workspaceId) {
    throw new Error("Missing WORKSPACE_ID");
  }

  return {
    apiKey,
    workspaceId,
  };
}

async function fetchBirdMessageInteractions({
  apiKey,
  workspaceId,
  channelId,
  messageId,
}) {
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  const encodedChannelId = encodeURIComponent(channelId);
  const encodedMessageId = encodeURIComponent(messageId);

  const url =
    `${BIRD}/workspaces/${encodedWorkspaceId}` +
    `/channels/${encodedChannelId}` +
    `/messages/${encodedMessageId}/interactions`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `AccessKey ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();

  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error("[sync-read-receipts] Bird request failed", {
      status: res.status,
      workspaceId,
      channelId,
      messageId,
      response: json,
    });

    const error = new Error("Bird interactions request failed");
    error.status = 502;
    throw error;
  }

  return json;
}

function findReadInteraction(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return (
    results.find(
      (interaction) =>
        String(interaction?.type || "").toLowerCase() === "read",
    ) || null
  );
}

export async function POST(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));

    const {
      organizationId: rawOrganizationId = null,
      threadId: rawThreadId = null,
      scheduledBroadcastId: rawScheduledBroadcastId = null,
      limit: rawLimit = 50,
      maxAgeHours: rawMaxAgeHours = 168,
    } = body;

    const organizationId =
      rawOrganizationId == null || rawOrganizationId === ""
        ? null
        : parsePositiveInt(rawOrganizationId);

    const threadId =
      rawThreadId == null || rawThreadId === ""
        ? null
        : parsePositiveInt(rawThreadId);

    const scheduledBroadcastId =
      rawScheduledBroadcastId == null ||
      rawScheduledBroadcastId === ""
        ? null
        : parseUuid(rawScheduledBroadcastId);

    const limit = parsePositiveInt(rawLimit);
    const maxAgeHours = parsePositiveInt(rawMaxAgeHours);

    if (
      rawOrganizationId != null &&
      rawOrganizationId !== "" &&
      !organizationId
    ) {
      return NextResponse.json(
        { error: "Invalid organization id" },
        { status: 400 },
      );
    }

    if (
      rawThreadId != null &&
      rawThreadId !== "" &&
      !threadId
    ) {
      return NextResponse.json(
        { error: "Invalid thread id" },
        { status: 400 },
      );
    }

    if (
      rawScheduledBroadcastId != null &&
      rawScheduledBroadcastId !== "" &&
      !scheduledBroadcastId
    ) {
      return NextResponse.json(
        { error: "Invalid scheduled broadcast id" },
        { status: 400 },
      );
    }

    if (!limit || limit > 500) {
      return NextResponse.json(
        { error: "Invalid limit" },
        { status: 400 },
      );
    }

    if (!maxAgeHours || maxAgeHours > 8760) {
      return NextResponse.json(
        { error: "Invalid maxAgeHours" },
        { status: 400 },
      );
    }

    const { apiKey, workspaceId } = getBirdBaseConfig();

    const messages =
      await getPendingWhatsappMessagesForReadReceiptSync({
        organizationId,
        threadId,
        scheduledBroadcastId,
        limit,
        maxAgeHours,
      });

    const organizationConfigCache = new Map();

    async function getCachedOrganizationConfig(orgId) {
      const parsedOrgId = parsePositiveInt(orgId);

      if (!parsedOrgId) {
        throw new Error("Message is missing a valid organization_id");
      }

      if (organizationConfigCache.has(parsedOrgId)) {
        return organizationConfigCache.get(parsedOrgId);
      }

      const config = await getOrganizationBirdConfig(parsedOrgId);

      if (!config?.channelId) {
        throw new Error(
          "Organization is missing a valid Bird channel configuration",
        );
      }

      organizationConfigCache.set(parsedOrgId, config);

      return config;
    }

    const summary = {
      foundPending: messages.length,
      checked: 0,
      updatedAsRead: 0,
      notReadYet: 0,
      failed: 0,
      chainReadsDetected: 0,
      chainNextStepsSent: 0,
      chainCompleted: 0,
      chainSkipped: 0,
      chainFailed: 0,
      chainErrors: [],
      errors: [],
    };

    for (const message of messages) {
      try {
        summary.checked += 1;

        if (!message?.id) {
          throw new Error("Pending message is missing its database id");
        }

        if (!message?.message_id) {
          throw new Error("Pending message is missing its Bird message id");
        }

        const messageOrganizationId = parsePositiveInt(
          message.organization_id,
        );

        if (!messageOrganizationId) {
          throw new Error(
            "Pending message is missing a valid organization_id",
          );
        }

        if (
          organizationId &&
          messageOrganizationId !== organizationId
        ) {
          throw new Error(
            "Pending message does not match the requested organization",
          );
        }

        if (
          threadId &&
          Number(message.thread_id) !== Number(threadId)
        ) {
          throw new Error(
            "Pending message does not match the requested thread",
          );
        }

        if (
          scheduledBroadcastId &&
          String(message.scheduled_broadcast_id || "") !==
            String(scheduledBroadcastId)
        ) {
          throw new Error(
            "Pending message does not match the requested scheduled broadcast",
          );
        }

        const organizationConfig =
          await getCachedOrganizationConfig(messageOrganizationId);

        const interactions = await fetchBirdMessageInteractions({
          apiKey,
          workspaceId,
          channelId: organizationConfig.channelId,
          messageId: message.message_id,
        });

        const readInteraction = findReadInteraction(interactions);

        if (!readInteraction) {
          summary.notReadYet += 1;
          continue;
        }

        const readAt =
          readInteraction.createdAt ||
          readInteraction.updatedAt ||
          new Date().toISOString();

        const updatedMessage = await markMessageRead(
          message.id,
          readAt,
        );

        if (!updatedMessage) {
          throw new Error("Failed to update message as read");
        }

        if (
          Number(updatedMessage.organization_id) !==
          messageOrganizationId
        ) {
          throw new Error(
            "Updated message organization does not match the source message",
          );
        }

        summary.updatedAsRead += 1;

        if (updatedMessage.message_chain_id) {
          summary.chainReadsDetected += 1;

          try {
            const chainResult =
              await processReadChainAfterRead(updatedMessage);

            if (chainResult?.completed) {
              summary.chainCompleted += 1;
            } else if (chainResult?.nextStepSent) {
              summary.chainNextStepsSent += 1;
            } else if (chainResult?.skipped) {
              summary.chainSkipped += 1;
            } else if (chainResult?.ok === false) {
              summary.chainFailed += 1;

              summary.chainErrors.push({
                messageDbId: updatedMessage.id,
                chainId: updatedMessage.message_chain_id,
                result: chainResult,
              });
            }
          } catch (chainError) {
            summary.chainFailed += 1;

            summary.chainErrors.push({
              messageDbId: updatedMessage.id,
              chainId: updatedMessage.message_chain_id,
              error:
                chainError?.message ||
                "Failed to process read chain",
            });
          }
        }
      } catch (error) {
        summary.failed += 1;

        summary.errors.push({
          messageDbId: message?.id || null,
          birdMessageId: message?.message_id || null,
          organizationId: message?.organization_id || null,
          error:
            error?.message ||
            "Failed to process pending message",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    console.error("[sync-read-receipts] failed:", error);

    const status =
      Number.isInteger(error?.status) &&
      error.status >= 400 &&
      error.status <= 599
        ? error.status
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error:
          status >= 500
            ? "Failed to sync read receipts"
            : error.message,
      },
      { status },
    );
  }
}