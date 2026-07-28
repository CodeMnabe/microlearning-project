"use client";

import { useCallback, useState } from "react";

import {
  buildBroadcastPayload,
  buildScheduledBroadcastPayload,
  buildScheduledReadChainPayload,
  formatBroadcastResultMessage,
  getBroadcastCounts,
  getChannelLabel,
  getFailedRecipients,
  getRecipientLabel,
  isFutureDate,
} from "../lib";
/**
 * Gere as ações principais do Broadcast.
 *
 * Responsabilidades:
 * - validar destinatários;
 * - validar conteúdo;
 * - validar links rastreados;
 * - validar read chains;
 * - pedir confirmação ao utilizador;
 * - enviar broadcasts imediatos;
 * - agendar broadcasts;
 * - iniciar ou agendar read chains de WhatsApp;
 * - apresentar feedback de sucesso, aviso ou erro.
 *
 * Este é o hook operacional da feature.
 * A page apenas recebe handleSend, handleSchedule e sending.
 */

export function useBroadcastActions({
  orgId,
  createdByUserId,

  channel,
  selectedUsers,

  chainMode,
  readChainsFeatureEnabled,
  hasFallbackTemplate,
  chainValid,

  trackedLinksValid,
  whatsappUrlBindingValid,

  tplName,
  tplLang,
  paramsComplete,

  composerMessage,
  composerFiles,

  buildBroadcastPayload,
  buildChainPayload,

  hourDraft,
  minuteDraft,
  commitTimeParts,
  scheduledDateFromDraft,
  browserTimeZone,

  setDeliveryMode,

  showAlert,
  confirm,
  translation,
}) {
  const [sending, setSending] = useState(false);

  const confirmSendAction = useCallback(
    async ({ isChain = false } = {}) => {
      const recipientLabel = getRecipientLabel(
        selectedUsers.length,
        translation,
      );
      const channelLabel = getChannelLabel(channel);

      if (isChain) {
        return confirm({
          title: translation("Broadcast.confirmSend.isChain.title"),
          message: translation("Broadcast.confirmSend.isChain.message", {
            recipientLabel,
          }),
          confirmText: translation("Broadcast.confirmSend.isChain.confirm"),
          cancelText: translation("Broadcast.confirmSend.isChain.cancel"),
        });
      }

      return confirm({
        title: translation("Broadcast.confirmSend.title"),
        message: translation("Broadcast.confirmSend.message", {
          channelLabel,
          recipientLabel,
        }),
        confirmText: translation("Broadcast.confirmSend.confirm"),
        cancelText: translation("Broadcast.confirmSend.cancel"),
      });
    },
    [channel, confirm, selectedUsers.length, translation],
  );

  const confirmScheduleAction = useCallback(
    async ({ scheduledDate, isChain = false } = {}) => {
      const recipientLabel = getRecipientLabel(
        selectedUsers.length,
        translation,
      );
      const channelLabel = getChannelLabel(channel);
      const formattedDate = scheduledDate.toLocaleString();

      if (isChain) {
        return confirm({
          title: translation("Broadcast.confirmSchedule.isChain.title"),
          message: translation("Broadcast.confirmSchedule.isChain.message", {
            recipientLabel,
            formattedDate,
          }),
          confirmText: translation("Broadcast.confirmSchedule.isChain.confirm"),
          cancelText: translation("Broadcast.confirmSchedule.isChain.cancel"),
        });
      }

      return confirm({
        title: translation("Broadcast.confirmSchedule.title"),
        message: translation("Broadcast.confirmSchedule.message", {
          channelLabel,
          recipientLabel,
          formattedDate,
        }),
        confirmText: translation("Broadcast.confirmSchedule.confirm"),
        cancelText: translation("Broadcast.confirmSchedule.cancel"),
      });
    },
    [channel, confirm, selectedUsers.length, translation],
  );

  const validateContentBeforeAction = useCallback(
    async (action) => {
      const hasManualContent =
        composerMessage.trim().length > 0 || composerFiles.length > 0;

      const hasValidTemplate =
        channel === "whatsapp" && tplName && tplLang && paramsComplete;

      const hasSelectedIncompleteTemplate =
        channel === "whatsapp" && tplName && tplLang && !paramsComplete;

      if (hasSelectedIncompleteTemplate && !hasManualContent && !chainMode) {
        await showAlert({
          title: translation("Broadcast.alerts.templateParamsMissing.title"),
          message: translation(
            "Broadcast.alerts.templateParamsMissing.message",
          ),
          tone: "warning",
        });

        return false;
      }

      if (!hasManualContent && !hasValidTemplate && !chainMode) {
        await showAlert({
          title: translation("Broadcast.alerts.contentMissing.title"),
          message:
            action === "schedule"
              ? translation("Broadcast.alerts.contentMissing.scheduleMessage")
              : translation("Broadcast.alerts.contentMissing.sendMessage"),
          tone: "warning",
        });

        return false;
      }

      return true;
    },
    [
      channel,
      chainMode,
      composerFiles.length,
      composerMessage,
      paramsComplete,
      showAlert,
      tplLang,
      tplName,
      translation,
    ],
  );

  const validateRecipients = useCallback(async () => {
    if (selectedUsers.length > 0) return true;

    await showAlert({
      title: "Choose recipients",
      message: translation("Broadcast.chooseRecipients"),
      tone: "warning",
    });

    return false;
  }, [selectedUsers.length, showAlert, translation]);

  const validateReadChain = useCallback(
    async ({ isSchedule = false } = {}) => {
      if (channel !== "whatsapp") {
        await showAlert({
          title: "WhatsApp only",
          message: "Read chains currently only work for WhatsApp.",
          tone: "warning",
        });

        return false;
      }

      if (!readChainsFeatureEnabled) {
        await showAlert({
          title: "Read chains are disabled",
          message: "Enable read chain messages in Automations first.",
          tone: "warning",
        });

        return false;
      }

      if (!hasFallbackTemplate) {
        await showAlert({
          title: "Choose fallback template",
          message:
            "Select a WhatsApp template. It is used only when the user's 24h window is closed.",
          tone: "warning",
        });

        return false;
      }

      if (!chainValid) {
        await showAlert({
          title: "Complete the chain",
          message: isSchedule
            ? "A scheduled read chain needs 2 to 10 freeform messages, and every message must have text or attachments. Tracked links must also be complete."
            : "A read chain needs 2 to 10 freeform messages, and every message must have text or attachments. Tracked links must also be complete.",
          tone: "warning",
        });

        return false;
      }

      return true;
    },
    [
      channel,
      chainValid,
      hasFallbackTemplate,
      readChainsFeatureEnabled,
      showAlert,
    ],
  );

  const validateTrackedLinks = useCallback(async () => {
    if (!trackedLinksValid) {
      await showAlert({
        title: "Invalid tracked links",
        message: "Please complete all tracked links and avoid duplicate keys.",
        tone: "warning",
      });

      return false;
    }

    if (!whatsappUrlBindingValid) {
      await showAlert({
        title: "Missing WhatsApp URL button link",
        message:
          "Please choose which tracked link should be used for the WhatsApp template URL button.",
        tone: "warning",
      });

      return false;
    }

    return true;
  }, [showAlert, trackedLinksValid, whatsappUrlBindingValid]);

  const handleSend = useCallback(async () => {
    if (!(await validateRecipients())) return;

    if (chainMode) {
      if (!(await validateReadChain())) return;

      const confirmed = await confirmSendAction({ isChain: true });

      if (!confirmed) return;

      setSending(true);

      try {
        const res = await fetch("/api/broadcast/read-chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildChainPayload(selectedUsers)),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to send read chain.");
        }

        const counts = getBroadcastCounts(data, selectedUsers.length);
        const failedRecipients = getFailedRecipients(
          data,
          selectedUsers,
          channel,
        );

        await showAlert({
          title:
            counts.failed > 0
              ? "Read chain started with issues"
              : "Read chain started",
          message: formatBroadcastResultMessage({
            channel,
            action: "started",
            ok: counts.ok,
            failed: counts.failed,
            note:
              data?.note ||
              "Message 1 was sent if the 24h window was open. If not, the fallback template was sent and the chain waits for a reply.",
            failedRecipients,
          }),
          tone: counts.failed > 0 ? "warning" : "success",
        });
      } catch (err) {
        console.error("[Broadcast] handleSend chain error:", err);

        await showAlert({
          title: translation("Common.error"),
          message: err.message,
          tone: "danger",
        });
      } finally {
        setSending(false);
      }

      return;
    }

    if (!(await validateContentBeforeAction("send"))) return;
    if (!(await validateTrackedLinks())) return;

    const confirmed = await confirmSendAction();

    if (!confirmed) return;

    setSending(true);

    try {
      const payload = buildBroadcastPayload(selectedUsers);
      const endpoint =
        channel === "whatsapp"
          ? "/api/broadcast/whatsapp"
          : "/api/broadcast/teams";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        console.error("Broadcast send error", data);

        await showAlert({
          title: translation("Common.error"),
          message:
            typeof data === "object" && data?.error
              ? data.error
              : translation("Common.error"),
          tone: "danger",
        });

        return;
      }

      const counts = getBroadcastCounts(data, selectedUsers.length);
      const failedRecipients = getFailedRecipients(
        data,
        selectedUsers,
        channel,
      );

      await showAlert({
        title:
          counts.failed > 0
            ? "Broadcast completed with issues"
            : "Broadcast sent",
        message: formatBroadcastResultMessage({
          channel,
          action: "sent",
          ok: counts.ok,
          failed: counts.failed,
          note: data?.note || null,
          failedRecipients,
        }),
        tone: counts.failed > 0 ? "warning" : "success",
      });
    } catch (err) {
      console.error("[Broadcast] handleSend error:", err);

      await showAlert({
        title: translation("Common.error"),
        message: err.message,
        tone: "danger",
      });
    } finally {
      setSending(false);
    }
  }, [
    buildBroadcastPayload,
    buildChainPayload,
    chainMode,
    channel,
    confirmSendAction,
    selectedUsers,
    showAlert,
    translation,
    validateContentBeforeAction,
    validateReadChain,
    validateRecipients,
    validateTrackedLinks,
  ]);

  const handleSchedule = useCallback(async () => {
    if (!(await validateRecipients())) return;

    const committed = commitTimeParts(hourDraft, minuteDraft);

    if (!committed) {
      await showAlert({
        title: "Invalid time",
        message: "Please enter a valid time between 08:00 and 20:00.",
        tone: "warning",
      });

      return;
    }

    const scheduledDate = scheduledDateFromDraft;

    if (!scheduledDate) {
      await showAlert({
        title: "Choose date and time",
        message: "Choose a valid date and time.",
        tone: "warning",
      });

      return;
    }

    if (!isFutureDate(scheduledDate)) {
      await showAlert({
        title: "Invalid schedule date",
        message: "The scheduled date must be in the future.",
        tone: "warning",
      });

      return;
    }

    if (chainMode) {
      if (!(await validateReadChain({ isSchedule: true }))) return;

      const confirmed = await confirmScheduleAction({
        scheduledDate,
        isChain: true,
      });

      if (!confirmed) return;

      setSending(true);

      try {
        const scheduledChainPayload = buildScheduledReadChainPayload({
          chainPayload: buildChainPayload(selectedUsers),
          scheduledDate,
          timezone: browserTimeZone,
        });

        const res = await fetch("/api/broadcast/read-chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scheduledChainPayload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to schedule read chain.");
        }

        const counts = getBroadcastCounts(data, selectedUsers.length);
        const failedRecipients = getFailedRecipients(
          data,
          selectedUsers,
          channel,
        );

        await showAlert({
          title:
            counts.failed > 0
              ? "Read chain scheduled with issues"
              : "Read chain scheduled",
          message: formatBroadcastResultMessage({
            channel,
            action: "scheduled",
            ok: counts.ok,
            failed: counts.failed,
            note:
              data?.note ||
              "Message 1 will be sent at the scheduled time. The next messages will continue after read receipts.",
            failedRecipients,
          }),
          tone: counts.failed > 0 ? "warning" : "success",
        });

        setDeliveryMode("now");
      } catch (err) {
        console.error("[Broadcast] handleSchedule chain error:", err);

        await showAlert({
          title: translation("Common.error"),
          message: err.message,
          tone: "danger",
        });
      } finally {
        setSending(false);
      }

      return;
    }

    if (!(await validateContentBeforeAction("schedule"))) return;
    if (!(await validateTrackedLinks())) return;

    const confirmed = await confirmScheduleAction({
      scheduledDate,
    });

    if (!confirmed) return;

    setSending(true);

    try {
      const payload = buildBroadcastPayload(selectedUsers);

      const scheduledBroadcastPayload = buildScheduledBroadcastPayload({
        orgId,
        createdByUserId,
        channel,
        scheduledDate,
        timezone: browserTimeZone,
        payload,
        recipientCount: selectedUsers.length,
      });

      const res = await fetch("/api/broadcast/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduledBroadcastPayload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Schedule broadcast error", data);

        await showAlert({
          title: translation("Common.error"),
          message: data?.error || translation("Common.error"),
          tone: "danger",
        });

        return;
      }

      const counts = getBroadcastCounts(data, selectedUsers.length);
      const failedRecipients = getFailedRecipients(
        data,
        selectedUsers,
        channel,
      );

      await showAlert({
        title:
          counts.failed > 0
            ? "Broadcast scheduled with issues"
            : "Broadcast scheduled",
        message: formatBroadcastResultMessage({
          channel,
          action: "scheduled",
          ok: counts.ok,
          failed: counts.failed,
          note: "These counts mean the broadcast was scheduled for those recipients. Delivery success will only be known when the scheduled broadcast is actually sent.",
          failedRecipients,
        }),
        tone: counts.failed > 0 ? "warning" : "success",
      });

      setDeliveryMode("now");
    } catch (err) {
      console.error("[Broadcast] handleSchedule error:", err);

      await showAlert({
        title: translation("Common.error"),
        message: err.message,
        tone: "danger",
      });
    } finally {
      setSending(false);
    }
  }, [
    browserTimeZone,
    buildBroadcastPayload,
    buildChainPayload,
    chainMode,
    channel,
    commitTimeParts,
    confirmScheduleAction,
    createdByUserId,
    hourDraft,
    minuteDraft,
    orgId,
    scheduledDateFromDraft,
    selectedUsers,
    setDeliveryMode,
    showAlert,
    translation,
    validateContentBeforeAction,
    validateReadChain,
    validateRecipients,
    validateTrackedLinks,
  ]);

  return {
    sending,
    handleSend,
    handleSchedule,
  };
}
