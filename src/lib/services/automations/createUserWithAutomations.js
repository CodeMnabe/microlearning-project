import { createUser } from "@/lib/repos/user.repo";
import { emitAutomationEvent } from "./automationEngine";
import { linkPendingTeamsInstallations } from "@/lib/services/teams/teamsConnection";

export async function createUserWithAutomations(input, options = {}) {
  const { strictAutomations = false } = options;

  const user = await createUser(input);

  try {
    await emitAutomationEvent({
      type: "user.created",
      organizationId: user.organization_id,
      userId: user.id,
      // Sem assistente: aplicam-se as regras de todos os atribuídos (#133).
      assistantId: null,
      baseTime: new Date(),
      payload: {
        userName: user.name || "",
        email: user.email || null,
      },
      /*
       * No Teams o bot só consegue escrever depois de o colaborador se
       * ligar a ele; essas regras disparam nessa altura (rota do Teams).
       */
      channels: ["whatsapp"],
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

  /*
   * Se já tinha instalado a app do Teams antes de ser adicionado, fica
   * ligado agora pelo email (#153), e as regras do Teams disparam aí.
   */
  try {
    await linkPendingTeamsInstallations({ user });
  } catch (error) {
    console.error("[Teams] Failed to link pending installation", {
      userId: user.id,
      message: error?.message || String(error),
    });
  }

  return user;
}
