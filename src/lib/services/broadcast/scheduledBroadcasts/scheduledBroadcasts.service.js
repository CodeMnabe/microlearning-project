/**
 * Scheduled Broadcasts service.
 *
 * Coordinates validation, persistence, delivery and automation-run status
 * updates. It returns plain values and never returns NextResponse.
 */

import { getOrganization } from "@/lib/repos/organizations.repo";
import {
  createScheduledBroadcast as createScheduledBroadcastRow,
  deleteScheduledBroadcast as deleteScheduledBroadcastRow,
  finishScheduledBroadcast,
  getDueScheduledBroadcasts,
  getOrgScheduledBroadcasts,
  markScheduledBroadcastProcessing,
  updateScheduledBroadcast as updateScheduledBroadcastRow,
} from "@/lib/repos/broadcast/scheduledBroadcasts.repo";
import {
  markAutomationRunFailed,
  markAutomationRunProcessing,
  markAutomationRunSent,
} from "@/lib/repos/automations/automationRuns.repo";
import { sendTeamsBroadcast } from "@/lib/services/broadcast/sendTeamsBroadcast";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";
import { BroadcastError } from "../shared";
import {
  buildScheduledBroadcastRow,
  buildScheduledBroadcastSendPayload,
  getScheduledBroadcastFinalStatus,
  normalizeScheduledBroadcastError,
  normalizeScheduledBroadcastSource,
  parseScheduledFor,
  pickScheduledBroadcastPatch,
  SCHEDULED_BROADCAST_CHANNELS,
} from "./scheduledBroadcast.helpers";

export async function createScheduledBroadcast(input = {}) {
  const {
    orgId,
    createdByUserId = null,
    channel,
    scheduledFor,
    timezone,
    payload,
    recipientCount = 0,
  } = input;

  if (!orgId || !channel || !scheduledFor || !payload) {
    throw new BroadcastError("Missing required fields", 400);
  }

  if (!SCHEDULED_BROADCAST_CHANNELS.has(channel)) {
    throw new BroadcastError("Invalid channel", 400);
  }

  const scheduledDate = parseScheduledFor(scheduledFor);
  if (!scheduledDate) {
    throw new BroadcastError("Invalid scheduledFor date", 400);
  }

  if (scheduledDate.getTime() <= Date.now()) {
    throw new BroadcastError("Scheduled date must be in the future", 400);
  }

  const organization = await getOrganization(orgId);
  if (!organization) {
    throw new BroadcastError("Organization not found", 400);
  }

  return createScheduledBroadcastRow(
    buildScheduledBroadcastRow({
      orgId,
      createdByUserId,
      channel,
      scheduledFor: scheduledDate,
      timezone,
      payload,
      recipientCount,
    })
  );
}

export async function listScheduledBroadcasts({ orgId, source = "all" }) {
  return getOrgScheduledBroadcasts(orgId, {
    source: normalizeScheduledBroadcastSource(source),
  });
}

export async function updateScheduledBroadcast({ id, body }) {
  const patch = pickScheduledBroadcastPatch(body);

  if (Object.keys(patch).length === 0) {
    throw new BroadcastError("No valid fields provided to update.", 400);
  }

  return updateScheduledBroadcastRow(id, patch);
}

export async function deleteScheduledBroadcast({ id }) {
  return deleteScheduledBroadcastRow(id);
}

async function syncAutomationRunProcessing(automationRunId) {
  if (!automationRunId) return;

  try {
    await markAutomationRunProcessing(automationRunId);
  } catch (error) {
    console.warn("[Automations] Failed to mark run processing", {
      automationRunId,
      message: error?.message || String(error),
    });
  }
}

async function syncAutomationRunSuccess(automationRunId) {
  if (!automationRunId) return;

  try {
    await markAutomationRunSent(automationRunId);
  } catch (error) {
    console.warn("[Automations] Failed to mark run sent", {
      automationRunId,
      message: error?.message || String(error),
    });
  }
}

async function syncAutomationRunFailure(automationRunId, errorMessage) {
  if (!automationRunId) return;

  try {
    await markAutomationRunFailed(automationRunId, errorMessage);
  } catch (error) {
    console.warn("[Automations] Failed to mark run failed", {
      automationRunId,
      message: error?.message || String(error),
    });
  }
}

async function processOneScheduledBroadcast(broadcast) {
  const automationRunId = broadcast?.payload?.automationRunId || null;
  let locked;

  try {
    locked = await markScheduledBroadcastProcessing(broadcast.id);
  } catch (error) {
    return {
      id: broadcast.id,
      ok: false,
      skipped: true,
      error: normalizeScheduledBroadcastError(error),
    };
  }

  if (!locked) {
    return {
      id: broadcast.id,
      ok: false,
      skipped: true,
      error: "Could not lock broadcast for processing",
    };
  }

  await syncAutomationRunProcessing(automationRunId);

  try {
    const payload = buildScheduledBroadcastSendPayload(broadcast);

    console.log("[Schedule Broadcast] payload before send", {
      broadcastId: broadcast.id,
      channel: broadcast.channel,
      payload,
    });

    let result;
    if (broadcast.channel === "whatsapp") {
      result = await sendWhatsappBroadcast(payload);
    } else if (broadcast.channel === "teams") {
      result = await sendTeamsBroadcast(payload);
    } else {
      throw new Error(`Unsupported channel: ${broadcast.channel}`);
    }

    const finalStatus = getScheduledBroadcastFinalStatus(result);
    await finishScheduledBroadcast(broadcast.id, { status: finalStatus });

    if (finalStatus === "failed") {
      await syncAutomationRunFailure(
        automationRunId,
        JSON.stringify(result?.results || result || {})
      );
    } else {
      await syncAutomationRunSuccess(automationRunId);
    }

    return {
      id: broadcast.id,
      ok: finalStatus !== "failed",
      status: finalStatus,
      result,
    };
  } catch (error) {
    console.error("[Schedule Broadcast] processOneBroadcast failed", {
      broadcastId: broadcast.id,
      channel: broadcast.channel,
      payload: broadcast.payload,
      error,
      message: error?.message,
      stack: error?.stack,
    });

    try {
      await finishScheduledBroadcast(broadcast.id, { status: "failed" });
    } catch (finishError) {
      console.error(
        `[Schedule Broadcast] Failed to mark ${broadcast.id} as failed:`,
        finishError
      );
    }

    const normalizedError = normalizeScheduledBroadcastError(error);
    await syncAutomationRunFailure(automationRunId, normalizedError);

    return {
      id: broadcast.id,
      ok: false,
      status: "failed",
      error: normalizedError,
    };
  }
}

export async function processScheduledBroadcasts({ limit = 500 } = {}) {
  const dueBroadcasts = await getDueScheduledBroadcasts(limit);

  if (!dueBroadcasts.length) {
    return {
      ok: true,
      message: "No schedule broadcasts due",
      processed: 0,
      results: [],
    };
  }

  const results = [];
  for (const broadcast of dueBroadcasts) {
    results.push(await processOneScheduledBroadcast(broadcast));
  }

  return {
    ok: true,
    processed: results.length,
    sent: results.filter((result) => result.status === "sent").length,
    partial: results.filter((result) => result.status === "partial").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.skipped).length,
    results,
  };
}
