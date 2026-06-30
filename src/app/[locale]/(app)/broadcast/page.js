"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./broadcast.module.css";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";

import BroadcastHeader from "./components/BroadcastHeader";
import MessageComposer from "./components/MessageComposer";
import AttachmentsPanel from "./components/panels/AttachmentsPanel";
import SchedulePanel from "./components/panels/SchedulePanel";
import TemplatePanel from "./components/panels/TemplatePanel";
import TrackedLinksPanel from "./components/panels/TrackedLinksPanel";
import RecipientsPanel from "./components/recipients/RecipientsPanel";
import ChainMessagesBar from "./components/ChainMessagesBar";


import {
  asList,
  formatHour,
  formatMinute,
  formatDelayLabel,

  MAX_CHAIN_DELAY_HOURS,
  isReadChainValid,

  getBroadcastCounts,
  getFailedRecipients,
  formatBroadcastResultMessage,

  getRecipientLabel,
  getChannelLabel,
  
  isFutureDate,

  buildFallbackTemplatePayload,
  buildBroadcastPayload as createBroadcastPayload,
  buildReadChainPayload as createReadChainPayload,
  buildScheduledBroadcastPayload as createScheduledBroadcastPayload,
  buildScheduledReadChainPayload as createScheduledReadChainPayload,
} from "./lib/broadcast.helpers";

import {
  useBroadcastRecipients,
  useBroadcastSchedule,
  useBroadcastComposer,
  useBroadcastAttachments,
  useBroadcastTrackedLinks,
  useBroadcastChains,
  useBroadcastTemplates,
} from "./hooks/broadcast.hooks";



export default function BroadcastPage() {
  const { user } = useAuth();
  const { org } = useOrganization(user);

  const translation = useTranslations();
  const showAlert = useAlert();
  const confirm = useConfirm();

  const showAlertRef = useRef(showAlert);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const supabase = useMemo(() => createClient(), []);
  const { stopLoading } = useGlobalLoader();
  const filterBtnRef = useRef(null);
 
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState("teams");
  const [deliveryMode, setDeliveryMode] = useState("now");
  const [activeToolPanel, setActiveToolPanel] = useState(null);

  const {
  scheduledFor,
  setScheduledFor,

  hourDraft,
  minuteDraft,

  timeError,
  browserTimeZone,
  scheduledDateFromDraft,
  scheduleInvalid,

  commitTimeParts,
  handleHourChange,
  handleMinuteChange,
} = useBroadcastSchedule({ deliveryMode });

  const {
  users,
  setUsers,

  q,
  setQ,

  selected,
  setSelected,

  allTags,
  setAllTags,

  assistantsList,
  setAssistantsList,

  filterOpen,
  setFilterOpen,

  selectedTagIds,
  setSelectedTagIds,

  selectedAssistantIds,
  setSelectedAssistantIds,

  activeFilterCount,
  normalizedUsers,
  selectedUsers,
  filtered,
  allOnPageSelected,

  toggleOne,
  toggleAllCurrent,
} = useBroadcastRecipients({ channel });

 const {
  readChainsFeatureEnabled,
  setReadChainsFeatureEnabled,

  chainMode,
  setChainMode,

  activeChainStepIndex,
  setActiveChainStepIndex,

  chainSteps,
  setChainSteps,

  addChainStep,
  duplicateChainStep,
  removeChainStep,

  updateChainStepDelayPart,

  activeDelay,
  activeDelayParts,
} = useBroadcastChains();

const {
  composerMessage,
  composerFiles,
  composerTrackedLinks,
  composerSelectedTrackedUrlKey,

  setComposerMessage,
  setComposerFiles,
  setComposerTrackedLinks,
  setComposerSelectedTrackedUrlKey,

  setSelectedTrackedUrlKey,
  activeChainStep,
} = useBroadcastComposer({
  chainMode,
  chainSteps,
  setChainSteps,
  activeChainStepIndex,
});

const {
  tplLoading,
  tplErr,

  tplName,
  setTplName,

  tplLang,

  varDefs,
  varValues,
  setVarValues,

  needsUrlVar,

  tplParamsManual,
  setTplParamsManual,

  nameOptions,
  chosenTemplate,

  orderedParamValues,
  sampleRecipient,
  preview,
  paramsComplete,

  loadTemplates,
} = useBroadcastTemplates({
  org,
  channel,
  selectedUsers,
  composerSelectedTrackedUrlKey,
  setSelectedTrackedUrlKey,
  showAlert,
  translation,
  stopLoading,
});

const {
  trackedLinkOptions,
  normalizedTrackedLinks,
  trackedLinksCount,
  trackedLinksValid,
  whatsappUrlBindingValid,
  previewMessageWithTrackedLinks,

  addTrackedLink,
  updateTrackedLink,
  removeTrackedLink,
} = useBroadcastTrackedLinks({
  channel,
  composerMessage,
  composerTrackedLinks,
  setComposerTrackedLinks,
  needsUrlVar,
  composerSelectedTrackedUrlKey,
  setComposerSelectedTrackedUrlKey,
  showAlert,
  translation,
});

const {
  fileInputRef,
  thumbInputRef,

  imageFiles,
  videoFiles,
  otherFiles,
  imageUrls,
  attachmentsCount,

  removeFile,
  handlePickFiles,
  openThumbnailPicker,
  handlePickThumbnail,
  removeThumbnail,
} = useBroadcastAttachments({
  supabase,
  composerFiles,
  setComposerFiles,
  showAlert,
  translation,
});

  const messageInputRef = useRef(null);


  const getUsers = useCallback(async () => {
    if (!org?.id) return;

    try {
      const res = await fetch(`/api/users?orgId=${org.id}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch users");
      }

      setUsers(asList(data, "items"));
    } catch (err) {
      console.warn("[Broadcast] users load error:", err);

      setUsers([]);

      await showAlertRef.current({
        title: translation("Broadcast.alerts.usersLoadFailed.title"),
        message: translation("Broadcast.alerts.usersLoadFailed.message"),
        tone: "danger",
      });
    }
  }, [org?.id, translation]);

  useEffect(() => {
    if (!org?.id) return;

    let alive = true;

    (async () => {
      try {
        const [assistantsData, tagsData] = await Promise.all([
          fetch(`/api/assistants?orgId=${org.id}`).then((r) => r.json()),
          fetch(`/api/tags?orgId=${org.id}`).then((r) => r.json()),
        ]);

        if (!alive) return;

        setAssistantsList(asList(assistantsData, "items"));
        setAllTags(asList(tagsData, "items"));
      } catch (err) {
        console.warn("[Broadcast] filters load error:", err);

        if (!alive) return;

        setAssistantsList([]);
        setAllTags([]);

        await showAlertRef.current({
          title: translation("Broadcast.alerts.filtersLoadFailed.title"),
          message: translation("Broadcast.alerts.filtersLoadFailed.message"),
          tone: "danger",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, translation]);

  useEffect(() => {
    if (!org?.id) return;

    let alive = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/messaging-feature?orgId=${org.id}&channel=whatsapp`,
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load read chain feature.");
        }

        if (!alive) return;

        setReadChainsFeatureEnabled(Boolean(data?.item?.read_chains_enabled));
      } catch (err) {
        console.warn("[Broadcast] read chain feature load error:", err);

        if (!alive) return;

        setReadChainsFeatureEnabled(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id]);

  

  useEffect(() => {
    if (!org?.id) return;

    let alive = true;

    (async () => {
      await getUsers();

      if (channel === "whatsapp") {
        await loadTemplates();
      }

      if (alive) stopLoading();
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, channel, getUsers, loadTemplates, stopLoading]);

  useEffect(() => {
    if (channel === "teams" && activeToolPanel === "template") {
      setActiveToolPanel(null);
    }

    if (channel !== "whatsapp" && chainMode) {
      setChainMode(false);
    }
  }, [channel, activeToolPanel, chainMode]);



  async function confirmSendAction({ isChain = false } = {}) {
    const recipientLabel = getRecipientLabel(selectedUsers.length, translation);
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
  }

  async function confirmScheduleAction({
    scheduledDate,
    isChain = false,
  } = {}) {
    const recipientLabel = getRecipientLabel(selectedUsers.length, translation);
    const channelLabel = getChannelLabel(channel);
    const formattedDate = scheduledDate.toLocaleString();

    if (isChain) {
      return confirm({
        title: translation("Broadcast.confirmSchedule.isChain.title"),
        // message: `You are about to schedule a WhatsApp read chain for ${recipientLabel}. Message 1 will send on ${formattedDate}. The next messages will send after read receipts and configured delays.`,
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
      // message: `You are about to schedule this ${channelLabel} broadcast for ${recipientLabel} on ${formattedDate}.`,
      message: translation("Broadcast.confirmSchedule.message", {
        channelLabel,
        recipientLabel,
        formattedDate,
      }),
      confirmText: translation("Broadcast.confirmSchedule.confirm"),
      cancelText: translation("Broadcast.confirmSchedule.cancel"),
    });
  }



  function toggleToolPanel(panel) {
    setActiveToolPanel((prev) => (prev === panel ? null : panel));
  }

  const hasFallbackTemplate =
    channel === "whatsapp" && tplName && tplLang && paramsComplete;

  
  const chainValid = useMemo(
  () =>
    isReadChainValid({
      chainMode,
      readChainsFeatureEnabled,
      channel,
      hasFallbackTemplate,
      chainSteps,
    }),
  [
    chainMode,
    readChainsFeatureEnabled,
    channel,
    hasFallbackTemplate,
    chainSteps,
  ],
);



  const baseCanSend =
    selected.size > 0 &&
    (chainMode
      ? chainValid
      : trackedLinksValid &&
        whatsappUrlBindingValid &&
        (channel === "whatsapp"
          ? (tplName && tplLang && paramsComplete) ||
            composerMessage.trim().length > 0 ||
            composerFiles.length > 0
          : composerMessage.trim().length > 0 || composerFiles.length > 0));


  const canSend = baseCanSend && !scheduleInvalid;

    function getFallbackTemplatePayload() {
      return buildFallbackTemplatePayload({
        chosenTemplate,
        tplName,
        tplLang,
        paramsComplete,
        orderedParamValues,
        varDefs,
        tplParamsManual,
        needsUrlVar,
        selectedTrackedUrlKey: composerSelectedTrackedUrlKey,
      });
    }

  function buildBroadcastPayload(chosen) {
  return createBroadcastPayload({
    channel,
    orgId: org?.id,
    users: chosen,
    message: composerMessage,
    imageUrls,
    files: composerFiles,
    trackedLinks: normalizedTrackedLinks,
    template: getFallbackTemplatePayload(),
  });
}

  function buildChainPayload(chosen) {
  return createReadChainPayload({
    orgId: org?.id,
    createdByUserId: user?.id || null,
    users: chosen,
    fallbackTemplate: getFallbackTemplatePayload(),
    steps: chainSteps,
  });
}

  

  async function validateContentBeforeAction(action) {
    const hasManualContent =
      composerMessage.trim().length > 0 || composerFiles.length > 0;

    const hasValidTemplate =
      channel === "whatsapp" && tplName && tplLang && paramsComplete;

    const hasSelectedIncompleteTemplate =
      channel === "whatsapp" && tplName && tplLang && !paramsComplete;

    if (hasSelectedIncompleteTemplate && !hasManualContent && !chainMode) {
      await showAlert({
        title: translation("Broadcast.alerts.templateParamsMissing.title"),
        message: translation("Broadcast.alerts.templateParamsMissing.message"),
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
  }

  async function handleSend() {
    if (!selectedUsers.length) {
      await showAlert({
        title: "Choose recipients",
        message: translation("Broadcast.chooseRecipients"),
        tone: "warning",
      });
      return;
    }

    if (chainMode) {
      if (channel !== "whatsapp") {
        await showAlert({
          title: "WhatsApp only",
          message: "Read chains currently only work for WhatsApp.",
          tone: "warning",
        });
        return;
      }

      if (!readChainsFeatureEnabled) {
        await showAlert({
          title: "Read chains are disabled",
          message: "Enable read chain messages in Automations first.",
          tone: "warning",
        });
        return;
      }

      if (!hasFallbackTemplate) {
        await showAlert({
          title: "Choose fallback template",
          message:
            "Select a WhatsApp template. It is used only when the user's 24h window is closed.",
          tone: "warning",
        });
        return;
      }

      if (!chainValid) {
        await showAlert({
          title: "Complete the chain",
          message:
            "A read chain needs 2 to 10 freeform messages, and every message must have text or attachments. Tracked links must also be complete.",
          tone: "warning",
        });
        return;
      }

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

    if (!trackedLinksValid) {
      await showAlert({
        title: "Invalid tracked links",
        message: "Please complete all tracked links and avoid duplicate keys.",
        tone: "warning",
      });
      return;
    }

    if (!whatsappUrlBindingValid) {
      await showAlert({
        title: "Missing WhatsApp URL button link",
        message:
          "Please choose which tracked link should be used for the WhatsApp template URL button.",
        tone: "warning",
      });
      return;
    }

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
  }

  async function handleSchedule() {
    if (!selectedUsers.length) {
      await showAlert({
        title: "Choose recipients",
        message: translation("Broadcast.chooseRecipients"),
        tone: "warning",
      });
      return;
    }

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
      if (channel !== "whatsapp") {
        await showAlert({
          title: "WhatsApp only",
          message: "Read chains currently only work for WhatsApp.",
          tone: "warning",
        });
        return;
      }

      if (!readChainsFeatureEnabled) {
        await showAlert({
          title: "Read chains are disabled",
          message: "Enable read chain messages in Automations first.",
          tone: "warning",
        });
        return;
      }

      if (!hasFallbackTemplate) {
        await showAlert({
          title: "Choose fallback template",
          message:
            "Select a WhatsApp template. It is used only when the user's 24h window is closed.",
          tone: "warning",
        });
        return;
      }

      if (!chainValid) {
        await showAlert({
          title: "Complete the chain",
          message:
            "A scheduled read chain needs 2 to 10 freeform messages, and every message must have text or attachments. Tracked links must also be complete.",
          tone: "warning",
        });
        return;
      }

      const confirmed = await confirmScheduleAction({
        scheduledDate,
        isChain: true,
      });

      if (!confirmed) return;

      setSending(true);

      try {
       const scheduledChainPayload = createScheduledReadChainPayload({
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

    if (!trackedLinksValid) {
      await showAlert({
        title: "Invalid tracked links",
        message: "Please complete all tracked links and avoid duplicate keys.",
        tone: "warning",
      });
      return;
    }

    if (!whatsappUrlBindingValid) {
      await showAlert({
        title: "Missing WhatsApp URL button link",
        message:
          "Please choose which tracked link should be used for the WhatsApp template URL button.",
        tone: "warning",
      });
      return;
    }

    const confirmed = await confirmScheduleAction({
      scheduledDate,
    });

    if (!confirmed) return;

    setSending(true);

    try {
      const payload = buildBroadcastPayload(selectedUsers);

      const scheduledBroadcastPayload = createScheduledBroadcastPayload({
        orgId: org?.id,
        createdByUserId: user?.id || null,
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
      console.error(err);

      await showAlert({
        title: translation("Common.error"),
        message: err.message,
        tone: "danger",
      });
    } finally {
      setSending(false);
    }
  }

  function insertTrackedPlaceholder(key) {
    const token = `{{link.${key}}}`;
    const textArea = messageInputRef.current;

    if (!textArea) {
      setComposerMessage(
        (prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${token}`,
      );
      return;
    }

    const start = textArea.selectionStart ?? composerMessage.length;
    const end = textArea.selectionEnd ?? composerMessage.length;

    const before = composerMessage.slice(0, start);
    const after = composerMessage.slice(end);

    const prefix =
      before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";

    const suffix =
      after && !after.startsWith(" ") && !after.startsWith("\n") ? " " : "";

    const inserted = `${prefix}${token}${suffix}`;
    const nextValue = before + inserted + after;

    setComposerMessage(nextValue);

    requestAnimationFrame(() => {
      textArea.focus();
      const nextCursor = before.length + inserted.length;
      textArea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const previewTime = useMemo(
    () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const scheduleButtonLabel =
    deliveryMode === "schedule"
      ? `${scheduledFor.toLocaleDateString()} ${formatHour(
          scheduledFor,
        )}:${formatMinute(scheduledFor)}`
      : translation("Broadcast.sendnow");

  const templateButtonLabel =
    channel === "whatsapp" && tplName ? tplName : "No template";

  const chainDelayTools =
    chainMode && activeChainStepIndex > 0 ? (
      <div className={styles.composerDelayTools}>
        <div className={styles.composerDelayTitle}>
          {translation("Broadcast.broadcastChain.chainDelayBefore")}{" "}
          {activeChainStepIndex + 1}
        </div>

        <div className={styles.composerDelayInputs}>
          <label className={styles.composerDelayField}>
            <span>{translation("Broadcast.broadcastChain.chainHour")}</span>
            <input
              type="number"
              min="0"
              max={MAX_CHAIN_DELAY_HOURS}
              step="1"
              value={activeDelayParts.hours}
              onChange={(event) =>
                updateChainStepDelayPart(
                  activeChainStepIndex,
                  "hours",
                  event.target.value,
                )
              }
            />
          </label>

          <label className={styles.composerDelayField}>
            <span>{translation("Broadcast.broadcastChain.chainMinute")}</span>
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              value={activeDelayParts.minutes}
              onChange={(event) =>
                updateChainStepDelayPart(
                  activeChainStepIndex,
                  "minutes",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <div className={styles.composerDelayHelp}>
          {formatDelayLabel(activeDelay, translation)}
        </div>
      </div>
    ) : chainMode && activeChainStepIndex === 0 ? (
      <div className={styles.composerDelayTools}>
        <div className={styles.composerDelayHelp}>
          {translation("Broadcast.broadcastChain.chainFirstMessage")}
        </div>
      </div>
    ) : null;

  return (
    <div className={styles.screen}>
      <BroadcastHeader
        channel={channel}
        setChannel={setChannel}
        selectedCount={selected.size}
        sending={sending}
        canSend={canSend}
        deliveryMode={deliveryMode}
        onPrimaryClick={
          deliveryMode === "schedule" ? handleSchedule : handleSend
        }
        translation={translation}
      />

      <div className={styles.columns}>
        <div className={styles.leftCol}>
          <MessageComposer
            messageInputRef={messageInputRef}
            message={composerMessage}
            setMessage={setComposerMessage}
            normalizedTrackedLinks={normalizedTrackedLinks}
            previewMessageWithTrackedLinks={previewMessageWithTrackedLinks}
            insertTrackedPlaceholder={insertTrackedPlaceholder}
            activeToolPanel={activeToolPanel}
            toggleToolPanel={toggleToolPanel}
            scheduleButtonLabel={scheduleButtonLabel}
            attachmentsCount={attachmentsCount}
            trackedLinksCount={trackedLinksCount}
            channel={channel}
            templateButtonLabel={templateButtonLabel}
            translation={translation}
            leftToolsContent={chainDelayTools}
            chainControls={
              channel === "whatsapp" ? (
                <ChainMessagesBar
                  enabled={readChainsFeatureEnabled}
                  chainMode={chainMode}
                  setChainMode={setChainMode}
                  chainSteps={chainSteps}
                  activeChainStepIndex={activeChainStepIndex}
                  setActiveChainStepIndex={setActiveChainStepIndex}
                  addChainStep={addChainStep}
                  duplicateChainStep={duplicateChainStep}
                  removeChainStep={removeChainStep}
                  hasFallbackTemplate={Boolean(hasFallbackTemplate)}
                  translation={translation}
                />
              ) : null
            }
          >
            {activeToolPanel === "schedule" && (
              <SchedulePanel
                deliveryMode={deliveryMode}
                setDeliveryMode={setDeliveryMode}
                scheduledFor={scheduledFor}
                setScheduledFor={setScheduledFor}
                hourDraft={hourDraft}
                minuteDraft={minuteDraft}
                handleHourChange={handleHourChange}
                handleMinuteChange={handleMinuteChange}
                commitTimeParts={commitTimeParts}
                timeError={timeError}
                scheduleInvalid={scheduleInvalid}
                browserTimeZone={browserTimeZone}
                translation={translation}
              />
            )}

            {activeToolPanel === "attachments" && (
              <AttachmentsPanel
                channel={channel}
                fileInputRef={fileInputRef}
                thumbInputRef={thumbInputRef}
                handlePickFiles={handlePickFiles}
                handlePickThumbnail={handlePickThumbnail}
                imageFiles={imageFiles}
                videoFiles={videoFiles}
                otherFiles={otherFiles}
                files={composerFiles}
                removeFile={removeFile}
                openThumbnailPicker={openThumbnailPicker}
                removeThumbnail={removeThumbnail}
                translation={translation}
              />
            )}

            {activeToolPanel === "links" && (
              <TrackedLinksPanel
                channel={channel}
                needsUrlVar={needsUrlVar}
                trackedLinks={composerTrackedLinks}
                trackedLinksValid={trackedLinksValid}
                trackedLinkOptions={trackedLinkOptions}
                selectedTrackedUrlKey={composerSelectedTrackedUrlKey}
                setSelectedTrackedUrlKey={setComposerSelectedTrackedUrlKey}
                whatsappUrlBindingValid={whatsappUrlBindingValid}
                addTrackedLink={addTrackedLink}
                updateTrackedLink={updateTrackedLink}
                removeTrackedLink={removeTrackedLink}
                translation={translation}
              />
            )}

            {activeToolPanel === "template" && channel === "whatsapp" && (
              <TemplatePanel
                tplErr={tplErr}
                tplLoading={tplLoading}
                nameOptions={nameOptions}
                tplName={tplName}
                setTplName={setTplName}
                varDefs={varDefs}
                varValues={varValues}
                setVarValues={setVarValues}
                tplLang={tplLang}
                tplParamsManual={tplParamsManual}
                setTplParamsManual={setTplParamsManual}
                paramsComplete={paramsComplete}
                org={org}
                sampleRecipient={sampleRecipient}
                preview={preview}
                previewTime={previewTime}
                translation={translation}
              />
            )}
          </MessageComposer>
        </div>

        <div className={styles.rightCol}>
          <RecipientsPanel
            filterBtnRef={filterBtnRef}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            activeFilterCount={activeFilterCount}
            allTags={allTags}
            assistantsList={assistantsList}
            selectedTagIds={selectedTagIds}
            setSelectedTagIds={setSelectedTagIds}
            selectedAssistantIds={selectedAssistantIds}
            setSelectedAssistantIds={setSelectedAssistantIds}
            q={q}
            setQ={setQ}
            filtered={filtered}
            selected={selected}
            toggleOne={toggleOne}
            toggleAllCurrent={toggleAllCurrent}
            allOnPageSelected={allOnPageSelected}
            channel={channel}
            translation={translation}
          />
        </div>
      </div>
    </div>
  );
}
