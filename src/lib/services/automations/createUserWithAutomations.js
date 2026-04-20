import { createUser } from "@/lib/repos/user.repo";
import { emitAutomationEvent } from "./automationEngine";

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
    console.error("[Automations] Failed to emit user.created", {
      userId: user.id,
      organizationId: user.organization_id,
      message: error?.message || String(error),
    });

    if (strictAutomations) {
      throw error;
    }
  }

  return user;
}
