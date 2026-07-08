export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isReadChainsEnabled } from "@/lib/repos/organizationMessagingFeature.repo";
import {
  createMessageChain,
  createMessageChainRecipients,
  createMessageChainSteps,
} from "@/lib/repos/messageChain.repo";
import { sendReadChainStep } from "@/lib/services/broadcast/readChains/sendReadChainStep";
import {
  assertUsersBelongToOrg,
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";

function normalizeRecipient(raw) {
  if (!raw || typeof raw !== "object") return null;

  const userId = raw.userId ?? raw.id ?? null;

  if (!userId) return null;

  return {
    ...raw,
    userId,
  };
}

function normalizeSteps(
  steps,
  fallbackTemplate = null,
  fallbackWhatsappTemplateId = null,
) {
  if (!Array.isArray(steps)) return [];

  return steps.map((step) => ({
    message: step?.message || "",
    files: Array.isArray(step?.files) ? step.files : [],
    imageUrls: Array.isArray(step?.imageUrls) ? step.imageUrls : [],
    trackedLinks: Array.isArray(step?.trackedLinks) ? step.trackedLinks : [],
    delayAfterPreviousReadMinutes: normalizeDelayMinutes(
      step?.delayAfterPreviousReadMinutes,
    ),
    template: step?.template || fallbackTemplate || null,
    whatsappTemplateId:
      step?.whatsappTemplateId || fallbackWhatsappTemplateId || null,
  }));
}

function stepHasFreeformContent(step) {
  return (
    String(step?.message || "").trim().length > 0 ||
    (Array.isArray(step?.files) && step.files.length > 0) ||
    (Array.isArray(step?.imageUrls) && step.imageUrls.length > 0)
  );
}

function hasFallbackTemplate({
  fallbackTemplate,
  fallbackWhatsappTemplateId,
  steps,
}) {
  if (fallbackTemplate?.projectId) return true;
  if (fallbackWhatsappTemplateId) return true;

  return steps.some(
    (step) => step?.template?.projectId || step?.whatsappTemplateId,
  );
}

function parseScheduledFor(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("scheduledFor must be a valid date.");
  }

  return date.toISOString();
}

function normalizeDelayMinutes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.floor(number);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      orgId,
      createdByUserId = null,
      channel = "whatsapp",
      recipients: rawRecipients = [],
      steps: rawSteps = [],
      fallbackTemplate = null,
      fallbackWhatsappTemplateId = null,
      scheduledFor = null,
      timezone = null,
    } = body || {};

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    if (channel !== "whatsapp") {
      return NextResponse.json(
        { error: "Read chains currently only support WhatsApp." },
        { status: 400 },
      );
    }

    const scheduledForIso = parseScheduledFor(scheduledFor);
    const isScheduled = Boolean(scheduledForIso);

    if (isScheduled && new Date(scheduledForIso).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledFor must be in the future." },
        { status: 400 },
      );
    }

    const enabled = await isReadChainsEnabled({
      organizationId: orgAuth.orgId,
      channel,
    });

    if (!enabled) {
      return NextResponse.json(
        { error: "Read chains are disabled for this organization." },
        { status: 403 },
      );
    }

    const recipients = rawRecipients.map(normalizeRecipient).filter(Boolean);

    const dedupedRecipients = Array.from(
      new Map(recipients.map((r) => [String(r.userId), r])).values(),
    );

    if (dedupedRecipients.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient with userId is required." },
        { status: 400 },
      );
    }

    await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      dedupedRecipients.map((recipient) => recipient.userId),
    );

    if (
      !hasFallbackTemplate({
        fallbackTemplate,
        fallbackWhatsappTemplateId,
        steps: rawSteps,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "A fallback WhatsApp template is required for read chains, so the system can reopen the conversation window when needed.",
        },
        { status: 400 },
      );
    }

    const steps = normalizeSteps(
      rawSteps,
      fallbackTemplate,
      fallbackWhatsappTemplateId,
    );

    if (steps.length < 2 || steps.length > 10) {
      return NextResponse.json(
        { error: "A read chain must have between 2 and 10 messages." },
        { status: 400 },
      );
    }

    const emptyStepIndex = steps.findIndex(
      (step) => !stepHasFreeformContent(step),
    );

    if (emptyStepIndex !== -1) {
      return NextResponse.json(
        {
          error: `Message ${emptyStepIndex + 1} is empty. Add text, files, or images. The fallback template does not count as the chain message content.`,
        },
        { status: 400 },
      );
    }

    const chain = await createMessageChain({
      organizationId: orgAuth.orgId,
      createdByUserId,
      channel,
      status: isScheduled ? "scheduled" : "active",
      scheduledFor: scheduledForIso,
      timezone: timezone || null,
      recipientCount: dedupedRecipients.length,
    });

    const chainSteps = await createMessageChainSteps({
      chainId: chain.id,
      steps,
    });

    const chainRecipients = await createMessageChainRecipients({
      chainId: chain.id,
      recipients: dedupedRecipients,
    });

    const firstStep = chainSteps.find((step) => Number(step.step_index) === 1);

    if (!firstStep) {
      return NextResponse.json(
        { error: "Could not create first chain step." },
        { status: 500 },
      );
    }

    if (isScheduled) {
      return NextResponse.json({
        ok: dedupedRecipients.length,
        failed: 0,
        sent: 0,
        waitingForReply: 0,
        scheduled: true,
        chainId: chain.id,
        recipientCount: dedupedRecipients.length,
        stepCount: steps.length,
        scheduledFor: scheduledForIso,
        timezone: timezone || null,
        results: chainRecipients.map((chainRecipient) => ({
          userId: chainRecipient.user_id,
          ok: true,
          sent: false,
          scheduled: true,
          waitingForReply: false,
          kind: "scheduled",
          stepIndex: 1,
          error: null,
          warning: null,
        })),
        note: "Read chain scheduled. Message 1 will be sent at the scheduled time, then the next messages will continue after read receipts.",
      });
    }

    const results = [];

    for (const chainRecipient of chainRecipients) {
      try {
        const sendResult = await sendReadChainStep({
          chain,
          chainRecipient,
          chainStep: firstStep,
          stepIndex: 1,
        });

        results.push({
          userId: chainRecipient.user_id,
          ok: sendResult.ok,
          sent: Boolean(sendResult.sent),
          waitingForReply: Boolean(sendResult.waitingForReply),
          kind: sendResult.kind || null,
          stepIndex: 1,
          error: sendResult.error || null,
          warning: sendResult.warning || null,
        });
      } catch (error) {
        results.push({
          userId: chainRecipient.user_id,
          ok: false,
          sent: false,
          waitingForReply: false,
          kind: "error",
          stepIndex: 1,
          error: error.message,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failedCount = results.length - okCount;
    const sentCount = results.filter((r) => r.sent).length;
    const waitingCount = results.filter((r) => r.waitingForReply).length;

    return NextResponse.json({
      ok: okCount,
      failed: failedCount,
      sent: sentCount,
      waitingForReply: waitingCount,
      scheduled: false,
      chainId: chain.id,
      recipientCount: dedupedRecipients.length,
      stepCount: steps.length,
      results,
      error:
        okCount === 0
          ? results[0]?.error || "Read chain failed for all recipients."
          : null,
      note:
        waitingCount > 0
          ? "Some recipients had a closed WhatsApp window. The fallback template was sent and the chain step is waiting for their reply."
          : null,
    });
  } catch (error) {
    return handleApiError(error, "Failed to create read chain");
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    route: "/api/broadcast/read-chain",
  });
}
