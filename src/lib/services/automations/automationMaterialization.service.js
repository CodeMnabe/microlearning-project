import {
  getDueAutomationRuns,
  markAutomationRunFailed,
  markAutomationRunMaterialized,
} from "@/lib/repos/automations/automationRuns.repo";

import {
  createScheduledBroadcast,
} from "@/lib/repos/broadcast/scheduledBroadcasts.repo";

import {
  getUserById,
} from "@/lib/repos/user.repo";

/**
 * Constrói o destinatário WhatsApp do utilizador.
 *
 * Mantém exatamente a lógica anteriormente existente
 * na route de materialização.
 */
function buildWhatsappRecipient(user) {
  if (user?.phone_number) {
    return user.phone_number;
  }

  if (
    user?.phone_country_code &&
    user?.phone_national
  ) {
    return `${user.phone_country_code}${String(
      user.phone_national,
    ).replace(/\D/g, "")}`;
  }

  return null;
}

/**
 * Materializa um único automation run.
 *
 * Responsável por:
 * - carregar o utilizador;
 * - construir o payload;
 * - validar o canal;
 * - criar o scheduled broadcast;
 * - associar o broadcast ao run;
 * - marcar o run como falhado quando necessário.
 */
async function materializeOneAutomationRun(run) {
  try {
    console.log("[materializeOne] start", {
      runId: run.id,
      userId: run.user_id,
      channel: run.channel,
      scheduledFor: run.scheduled_for,
    });

    const user = await getUserById(
      run.user_id,
    );

    console.log("[materializeOne] user", {
      found: Boolean(user),
      userId: user?.id,
      phone: user?.phone_number,
      assistantId: user?.assistant_id,
    });

    if (!user) {
      await markAutomationRunFailed(
        run.id,
        "User not found while materializing automation run",
      );

      return {
        id: run.id,
        ok: false,
        error: "User not found",
      };
    }

    const payload = {
      ...(run.payload || {}),
      orgId: run.organization_id,
      automationRunId: run.id,
    };

    if (run.channel === "whatsapp") {
      const recipient =
        buildWhatsappRecipient(user);

      console.log(
        "[materializeOne] whatsapp recipient",
        {
          recipient,
        },
      );

      if (!recipient) {
        await markAutomationRunFailed(
          run.id,
          "User has no WhatsApp destination",
        );

        return {
          id: run.id,
          ok: false,
          error:
            "User has no WhatsApp destination",
        };
      }

      payload.recipients = [recipient];
    } else if (run.channel === "teams") {
      payload.userIds = [user.id];
    } else {
      await markAutomationRunFailed(
        run.id,
        `Unsupported channel: ${run.channel}`,
      );

      return {
        id: run.id,
        ok: false,
        error:
          `Unsupported channel: ${run.channel}`,
      };
    }

    console.log(
      "[materializeOne] creating scheduled_broadcast",
      {
        organization_id:
          run.organization_id,

        channel:
          run.channel,

        scheduled_for:
          run.scheduled_for,

        recipient_count: 1,

        payload,
      },
    );

    const broadcast =
      await createScheduledBroadcast({
        organization_id:
          run.organization_id,

        channel:
          run.channel,

        status: "queued",

        scheduled_for:
          run.scheduled_for,

        recipient_count: 1,

        payload,
      });

    console.log(
      "[materializeOne] scheduled_broadcast created",
      {
        broadcastId: broadcast?.id,
      },
    );

    await markAutomationRunMaterialized(
      run.id,
      broadcast.id,
    );

    console.log(
      "[materializeOne] automation_run marked materialized",
      {
        runId: run.id,
        broadcastId: broadcast.id,
      },
    );

    return {
      id: run.id,
      ok: true,
      scheduledBroadcastId: broadcast.id,
    };
  } catch (error) {
    console.error(
      "[materializeOne] failed",
      {
        runId: run.id,
        message:
          error?.message ||
          String(error),
        error,
      },
    );

    await markAutomationRunFailed(
      run.id,
      error?.message || String(error),
    );

    return {
      id: run.id,
      ok: false,
      error:
        error?.message ||
        String(error),
    };
  }
}

/**
 * Materializa os automation runs que já atingiram
 * a respetiva data de execução.
 *
 * Mantém:
 * - limite recebido pela route;
 * - processamento sequencial;
 * - estrutura atual da resposta;
 * - logs atuais.
 */
export async function processAutomationMaterialization({
  limit = 200,
} = {}) {
  console.log(
    "[materialize] now:",
    new Date().toISOString(),
  );

  const dueRuns =
    await getDueAutomationRuns(limit);

  console.log(
    "[materialize] dueRuns:",
    dueRuns.map((run) => ({
      id: run.id,
      status: run.status,
      scheduled_for:
        run.scheduled_for,
    })),
  );

  if (!dueRuns.length) {
    return {
      ok: true,
      message:
        "No automation runs due",
      processed: 0,
      results: [],
    };
  }

  const results = [];

  for (const run of dueRuns) {
    console.log(
      "[materialize] loop run",
      run.id,
    );

    results.push(
      await materializeOneAutomationRun(
        run,
      ),
    );
  }

  return {
    ok: true,

    processed:
      results.length,

    materialized:
      results.filter(
        (result) => result.ok,
      ).length,

    failed:
      results.filter(
        (result) => !result.ok,
      ).length,

    results,
  };
}