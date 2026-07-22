import { createUser } from "@/lib/repos/user.repo";
import { emitAutomationEvent } from "./automationEngine";
import { logger } from "@/lib/observability/logger";

export async function createUserWithAutomations(input, options = {}) {
  const { strictAutomations = false } = options;

  const user = await createUser(input);

  try {
    await emitAutomationEvent({
      type: "user.created",
      organizationId: user.organization_id,
      userId: user.id,
      assistantId: user.assistant_id ?? null,
      baseTime: new Date(),
      payload: {
        userName: user.name || "",
        email: user.email || null,
      },
    });
  } catch (error) {
    logger.error(
      "automation_event_emit_failed",
      {
        provider: "internal",
        operation: "user_created_event",
        outcome: "failed",
        userId: user.id,
        organizationId: user.organization_id,
        assistantId: user.assistant_id,
      },
      error,
    );

    if (strictAutomations) {
      throw error;
    }
  }

  return user;
}
