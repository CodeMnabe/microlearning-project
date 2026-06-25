export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  getPendingWhatsappMessagesForReadReceiptSync,
  markMessageRead,
} from "@/lib/repos/messages.repo";
import { getOrganizationBirdConfig } from "@/lib/repos/organizations.repo";
import { processReadChainAfterRead } from "@/lib/services/broadcast/readChains/processReadChainAfterRead";

const BIRD = "https://api.bird.com";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

function getBirdBaseConfig() {
  const apiKey = process.env.BIRD_API_KEY;
  const workspaceId = process.env.WORKSPACE_ID;

  if (!apiKey) throw new Error("Missing BIRD_API_KEY");
  if (!workspaceId) throw new Error("Missing WORKSPACE_ID");

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
  const url = `${BIRD}/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}/interactions`;

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
    throw new Error(
      `Bird interactions request failed: ${res.status} ${JSON.stringify(json)}`,
    );
  }

  return json;
}

function findReadInteraction(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return results.find((interaction) => interaction.type === "read") || null;
}

export async function POST(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const {
      organizationId = null,
      threadId = null,
      scheduledBroadcastId = null,
      limit = 50,
      maxAgeHours = 168,
    } = body;

    const { apiKey, workspaceId } = getBirdBaseConfig();

    const messages = await getPendingWhatsappMessagesForReadReceiptSync({
      organizationId,
      threadId,
      scheduledBroadcastId,
      limit,
      maxAgeHours,
    });

    const organizationConfigCache = new Map();

    async function getCachedOrganizationConfig(orgId) {
      if (!orgId) {
        throw new Error("Message is missing organization_id");
      }

      if (organizationConfigCache.has(orgId)) {
        return organizationConfigCache.get(orgId);
      }

      const config = await getOrganizationBirdConfig(orgId);

      organizationConfigCache.set(orgId, config);

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

        const organizationConfig = await getCachedOrganizationConfig(
          message.organization_id,
        );

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

        const updatedMessage = await markMessageRead(message.id, readAt);

        summary.updatedAsRead += 1;

        if (updatedMessage?.message_chain_id) {
          summary.chainReadsDetected += 1;

          try {
            const chainResult = await processReadChainAfterRead(updatedMessage);

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
              error: chainError.message,
            });
          }
        }
      } catch (error) {
        summary.failed += 1;

        summary.errors.push({
          messageDbId: message.id,
          birdMessageId: message.message_id,
          organizationId: message.organization_id,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    console.error("[sync-read-receipts] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to sync read receipts",
      },
      { status: 500 },
    );
  }
}
