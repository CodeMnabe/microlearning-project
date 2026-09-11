"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./broadcast.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import {
  BROADCAST_IMAGES_BUCKET,
  buildBroadcastImageKey,
} from "@/lib/uploads/broadcastImages";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import { sanitizeOpeningBody } from "@/lib/whatsapp/openingTemplate";

import BroadcastHeader from "./components/BroadcastHeader";
import MessageComposer from "./components/MessageComposer";
import PhoneComposer from "./components/PhoneComposer";
import OpeningComposer from "./components/OpeningComposer";
import StartMenu from "./components/StartMenu";
import SchedulePanel from "./components/panels/SchedulePanel";
import TrackedLinksPanel from "./components/panels/TrackedLinksPanel";
import RecipientsPanel from "./components/recipients/RecipientsPanel";
import ChainMessagesBar from "./components/ChainMessagesBar";

import { COMPANY_KEYS, NAME_KEYS } from "./lib/constants";
import {
  asList,
  buildInitialScheduledDate,
  formatHour,
  formatMinute,
  guessContentTypeFromName,
  isImageContentType,
  isVideoContentType,
  makeTrackedLinkDraft,
  sanitizeTrackedKey,
  makeChainStep,
  formatDelayLabel,
} from "./lib/helpers";

const EMPTY_ARRAY = [];

const MAX_CHAIN_DELAY_MINUTES = 10080; // 7 days
const MAX_CHAIN_DELAY_HOURS = 168;

function splitDelayMinutes(totalMinutes) {
  const total = Number(totalMinutes || 0);

  if (!Number.isFinite(total) || total <= 0) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(Math.max(Math.floor(number), min), max);
}

function getRecipientLabel(count, translation) {
  return count === 1
    ? `1 ${translation("Broadcast.recipient")}`
    : `${count} ${translation("Broadcast.smallRecipients")}`;
}

function getChannelLabel(channel) {
  return channel === "whatsapp" ? "WhatsApp" : "Teams";
}

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

  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [allTags, setAllTags] = useState([]);
  const [assistantsList, setAssistantsList] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedAssistantIds, setSelectedAssistantIds] = useState([]);
  const activeFilterCount = selectedTagIds.length + selectedAssistantIds.length;

  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const editorRef = useRef(null);
  const [thumbForVideoUrl, setThumbForVideoUrl] = useState(null);

  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [trackedLinks, setTrackedLinks] = useState([]);

  const [sending, setSending] = useState(false);

  const [channel, setChannel] = useState("teams");
  const [deliveryMode, setDeliveryMode] = useState("now");
  const [activeToolPanel, setActiveToolPanel] = useState(null);

  /*
   * Tipo de mensagem WhatsApp: null mostra o menu de arranque, "opening" é
   * a mensagem de abertura (template) e "blank" é a mensagem livre.
   */
  const [composeMode, setComposeMode] = useState(null);
  const [openingInfo, setOpeningInfo] = useState(null);
  const [openingBody, setOpeningBody] = useState("");
  const [openingLoading, setOpeningLoading] = useState(false);
  const [openingFailed, setOpeningFailed] = useState(false);

  const initialScheduledDate = useMemo(() => buildInitialScheduledDate(), []);
  const [scheduledFor, setScheduledFor] = useState(initialScheduledDate);
  const [hourDraft, setHourDraft] = useState(() =>
    formatHour(initialScheduledDate),
  );
  const [minuteDraft, setMinuteDraft] = useState(() =>
    formatMinute(initialScheduledDate),
  );
  const [timeError, setTimeError] = useState("");

  const [readChainsFeatureEnabled, setReadChainsFeatureEnabled] =
    useState(false);
  const [chainMode, setChainMode] = useState(false);
  const [activeChainStepIndex, setActiveChainStepIndex] = useState(0);
  const [chainSteps, setChainSteps] = useState(() => [
    makeChainStep(),
    makeChainStep(),
  ]);

  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const isWhatsapp = channel === "whatsapp";
  const showStartMenu = isWhatsapp && composeMode === null;
  const isOpeningMode = isWhatsapp && composeMode === "opening";

  const activeChainStep = chainSteps[activeChainStepIndex] || chainSteps[0];

  const activeChainStepFiles = activeChainStep?.files || EMPTY_ARRAY;
  const activeChainStepTrackedLinks =
    activeChainStep?.trackedLinks || EMPTY_ARRAY;

  const composerMessage = chainMode ? activeChainStep?.message || "" : message;
  const composerFiles = chainMode ? activeChainStepFiles : files;
  const composerTrackedLinks = chainMode
    ? activeChainStepTrackedLinks
    : trackedLinks;

  const updateActiveChainStep = useCallback(
    (patchOrUpdater) => {
      setChainSteps((prev) =>
        prev.map((step, index) => {
          if (index !== activeChainStepIndex) return step;

          const patch =
            typeof patchOrUpdater === "function"
              ? patchOrUpdater(step)
              : patchOrUpdater;

          return {
            ...step,
            ...patch,
          };
        }),
      );
    },
    [activeChainStepIndex],
  );

  const setComposerMessage = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setMessage(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        message:
          typeof nextValue === "function"
            ? nextValue(step.message || "")
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  const setComposerFiles = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setFiles(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        files:
          typeof nextValue === "function"
            ? nextValue(step.files || [])
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  const setComposerTrackedLinks = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setTrackedLinks(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        trackedLinks:
          typeof nextValue === "function"
            ? nextValue(step.trackedLinks || [])
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  function addChainStep() {
    setChainSteps((prev) => {
      if (prev.length >= 10) return prev;

      const next = [...prev, makeChainStep()];
      setActiveChainStepIndex(next.length - 1);

      return next;
    });
  }

  function duplicateChainStep() {
    setChainSteps((prev) => {
      if (prev.length >= 10) return prev;

      const current = prev[activeChainStepIndex] || makeChainStep();

      const copy = makeChainStep({
        message: current.message || "",
        files: Array.isArray(current.files) ? [...current.files] : [],
        trackedLinks: Array.isArray(current.trackedLinks)
          ? current.trackedLinks.map((link) => ({
              ...link,
              id: makeTrackedLinkDraft().id,
            }))
          : [],
        delayAfterPreviousReadMinutes: Number(
          current.delayAfterPreviousReadMinutes || 0,
        ),
      });

      const next = [
        ...prev.slice(0, activeChainStepIndex + 1),
        copy,
        ...prev.slice(activeChainStepIndex + 1),
      ];

      setActiveChainStepIndex(activeChainStepIndex + 1);

      return next;
    });
  }

  function removeChainStep(indexToRemove) {
    setChainSteps((prev) => {
      if (prev.length <= 2) return prev;

      const next = prev.filter((_, index) => index !== indexToRemove);

      setActiveChainStepIndex((current) =>
        Math.min(
          current >= indexToRemove ? current - 1 : current,
          next.length - 1,
        ),
      );

      return next;
    });
  }

  function updateChainStepDelay(indexToUpdate, value) {
    const raw = Number(value);
    const delay = Number.isFinite(raw)
      ? Math.min(Math.max(Math.floor(raw), 0), MAX_CHAIN_DELAY_MINUTES)
      : 0;

    setChainSteps((prev) =>
      prev.map((step, index) => {
        if (index !== indexToUpdate) return step;

        return {
          ...step,
          delayAfterPreviousReadMinutes: index === 0 ? 0 : delay,
        };
      }),
    );
  }

  function updateChainStepDelayPart(indexToUpdate, part, value) {
    if (indexToUpdate === 0) return;

    const currentStep = chainSteps[indexToUpdate] || {};
    const currentDelay = Number(currentStep.delayAfterPreviousReadMinutes || 0);

    const current = splitDelayMinutes(currentDelay);

    const nextHours =
      part === "hours"
        ? clampNumber(value, 0, MAX_CHAIN_DELAY_HOURS)
        : current.hours;

    const nextMinutes =
      part === "minutes" ? clampNumber(value, 0, 59) : current.minutes;

    updateChainStepDelay(indexToUpdate, nextHours * 60 + nextMinutes);
  }

  const imageFiles = useMemo(
    () => composerFiles.filter((f) => isImageContentType(f.contentType)),
    [composerFiles],
  );

  const videoFiles = useMemo(
    () => composerFiles.filter((f) => isVideoContentType(f.contentType)),
    [composerFiles],
  );

  const otherFiles = useMemo(
    () =>
      composerFiles.filter(
        (f) =>
          !isImageContentType(f.contentType) &&
          !isVideoContentType(f.contentType),
      ),
    [composerFiles],
  );

  const imageUrls = useMemo(() => imageFiles.map((f) => f.url), [imageFiles]);

  const normalizedTrackedLinks = useMemo(
    () =>
      composerTrackedLinks
        .map((l) => ({
          key: sanitizeTrackedKey(l.key),
          label: String(l.label || "").trim(),
          destinationUrl: String(l.destinationUrl || "").trim(),
        }))
        .filter((l) => l.key && l.label && l.destinationUrl),
    [composerTrackedLinks],
  );

  const trackedLinksCount = normalizedTrackedLinks.length;

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

  /*
   * Mensagem de abertura da organização: início, fim e corpo por omissão.
   * O corpo pode ser ajustado só para este envio.
   */
  const loadOpening = useCallback(async () => {
    if (!org?.id) return;

    setOpeningLoading(true);
    setOpeningFailed(false);

    try {
      const res = await fetch(
        `/api/organizations/opening-message?orgId=${org.id}`,
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.item) {
        throw new Error(data?.error || "Failed to load opening message");
      }

      setOpeningInfo(data.item);
      setOpeningBody((current) => current || data.item.body || "");
    } catch (err) {
      console.warn("[Broadcast] opening message load error:", err);
      setOpeningFailed(true);
    } finally {
      setOpeningLoading(false);
    }
  }, [org?.id]);

  useEffect(() => {
    loadOpening();
  }, [loadOpening]);

  useEffect(() => {
    if (!org?.id) return;

    let alive = true;

    (async () => {
      await getUsers();

      if (alive) stopLoading();
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, getUsers, stopLoading]);

  useEffect(() => {
    if (channel !== "whatsapp" && chainMode) {
      setChainMode(false);
    }
  }, [channel, chainMode]);

  const normalizedUsers = useMemo(() => {
    return (users || []).map((u) => ({
      ...u,
      id: u.id,
      name: u.name,
      phone_number: u.phone_number ?? u.phoneNumber ?? "",
      whatsapp_bsuid: u.whatsapp_bsuid ?? u.whatsappBsuid ?? "",
      whatsapp_username: u.whatsapp_username ?? u.whatsappUsername ?? "",
      bird_contact_id: u.bird_contact_id ?? u.birdContactId ?? "",
      email: u.email ?? "",
      tagIds: u.tag_ids ?? (u.tags || []).map((t) => t.id),
      assistantId: u.assistant_id ?? null,
    }));
  }, [users]);

  const selectedUsers = useMemo(
    () => normalizedUsers.filter((u) => selected.has(u.id)),
    [normalizedUsers, selected],
  );

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

    if (isOpeningMode) {
      return confirm({
        title: translation("Broadcast.confirmSend.opening.title"),
        message: translation("Broadcast.confirmSend.opening.message", {
          recipientLabel,
        }),
        confirmText: translation("Broadcast.confirmSend.confirm"),
        cancelText: translation("Broadcast.confirmSend.cancel"),
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
        message: translation("Broadcast.confirmSchedule.isChain.message", {
          recipientLabel,
          formattedDate,
        }),
        confirmText: translation("Broadcast.confirmSchedule.isChain.confirm"),
        cancelText: translation("Broadcast.confirmSchedule.isChain.cancel"),
      });
    }

    if (isOpeningMode) {
      return confirm({
        title: translation("Broadcast.confirmSchedule.opening.title"),
        message: translation("Broadcast.confirmSchedule.opening.message", {
          recipientLabel,
          formattedDate,
        }),
        confirmText: translation("Broadcast.confirmSchedule.confirm"),
        cancelText: translation("Broadcast.confirmSchedule.cancel"),
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
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return normalizedUsers.filter((u) => {
      const textHay = `${u.name || ""} ${u.phone_number || ""}
        ${u.whatsapp_username || ""} ${u.whatsapp_bsuid}
         ${u.email || ""}`.toLowerCase();

      const textOk = !term || textHay.includes(term);

      const tagsOk =
        selectedTagIds.length === 0 ||
        selectedTagIds.every((id) => (u.tagIds || []).includes(id));

      const assistantOk =
        selectedAssistantIds.length === 0 ||
        selectedAssistantIds.includes(u.assistantId);

      const channelOk =
        channel !== "whatsapp" ||
        !!u.phone_number ||
        !!u.whatsapp_bsuid ||
        u.bird_contact_id;

      return channelOk && textOk && tagsOk && assistantOk;
    });
  }, [normalizedUsers, q, selectedTagIds, selectedAssistantIds, channel]);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function toggleAllCurrent() {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = filtered.map((u) => u.id);
      const allSel = ids.length > 0 && ids.every((id) => next.has(id));

      if (allSel) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function removeFile(url) {
    setComposerFiles((prev) => prev.filter((f) => f.url !== url));
  }

  function addTrackedLink() {
    setComposerTrackedLinks((prev) => [...prev, makeTrackedLinkDraft()]);
  }

  function updateTrackedLink(id, field, value) {
    setComposerTrackedLinks((prev) =>
      prev.map((link) => {
        if (link.id !== id) return link;

        if (field === "key") {
          return { ...link, key: sanitizeTrackedKey(value) };
        }

        return { ...link, [field]: value };
      }),
    );
  }

  function removeTrackedLink(id) {
    setComposerTrackedLinks((prev) => prev.filter((x) => x.id !== id));
  }

  function toggleToolPanel(panel) {
    setActiveToolPanel((prev) => (prev === panel ? null : panel));
  }

  const supabaseUpload = async (pickedFiles) => {
    const bucket = BROADCAST_IMAGES_BUCKET;
    const uploaded = [];

    const makeSafeName = (name) => {
      let safe = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
      safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safe) safe = "file";
      return safe;
    };

    for (const file of pickedFiles) {
      const safeName = makeSafeName(file.name);
      const key = buildBroadcastImageKey(org?.id, safeName);
      const ct = file.type || guessContentTypeFromName(file.name);

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(key, file, { upsert: false, contentType: ct });

      if (upErr) {
        console.error("Supabase upload error:", upErr);
        throw upErr;
      }

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);

      if (pub?.publicUrl) {
        uploaded.push({
          url: pub.publicUrl,
          name: file.name || safeName,
          contentType: ct || "application/octet-stream",
        });
      }
    }

    return uploaded;
  };

  async function handlePickFiles(e) {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;

    try {
      const uploaded = await supabaseUpload(picked);
      setComposerFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      await showAlert({
        title: translation("Common.error"),
        message: err.message,
        tone: "danger",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click?.();
  }

  function openThumbnailPicker(videoUrl) {
    setThumbForVideoUrl(videoUrl);

    setTimeout(() => {
      thumbInputRef.current?.click?.();
    }, 0);
  }

  async function handlePickThumbnail(e) {
    const picked = Array.from(e.target.files || []);

    if (!picked.length || !thumbForVideoUrl) {
      if (thumbInputRef.current) thumbInputRef.current.value = "";
      return;
    }

    try {
      const img = picked[0];
      const uploaded = await supabaseUpload([img]);
      const thumb = uploaded[0];

      if (thumb?.url) {
        setComposerFiles((prev) =>
          prev.map((f) =>
            f.url === thumbForVideoUrl ? { ...f, thumbnailUrl: thumb.url } : f,
          ),
        );
      }
    } catch (err) {
      await showAlert({
        title: translation("Common.error"),
        message: err.message,
        tone: "danger",
      });
    } finally {
      setThumbForVideoUrl(null);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  }

  function removeThumbnail(videoUrl) {
    setComposerFiles((prev) =>
      prev.map((f) => (f.url === videoUrl ? { ...f, thumbnailUrl: null } : f)),
    );
  }

  const sampleRecipient = selectedUsers[0] || null;
  const sampleName =
    sampleRecipient?.name || translation("Broadcast.composer.contact");

  /*
   * Rótulos das pastilhas no balão. Nome e empresa são preenchidos no envio;
   * os links rastreados vêm da lista de links desta mensagem.
   */
  const tokenLabel = useCallback(
    (key) => {
      const k = String(key || "").toLowerCase();

      if (NAME_KEYS.includes(k)) {
        return translation("Broadcast.composer.variableName");
      }

      if (COMPANY_KEYS.includes(k)) {
        return translation("Broadcast.composer.variableCompany");
      }

      if (k.startsWith("link.")) {
        const linkKey = k.slice("link.".length);
        const link = normalizedTrackedLinks.find((l) => l.key === linkKey);
        return `Link: ${link?.label || linkKey}`;
      }

      return null;
    },
    [normalizedTrackedLinks, translation],
  );

  const composerVariables = useMemo(
    () => [
      {
        key: "nome",
        kind: "name",
        label: translation("Broadcast.composer.variableName"),
      },
      {
        key: "empresa",
        kind: "company",
        label: translation("Broadcast.composer.variableCompany"),
      },
      ...normalizedTrackedLinks.map((l) => ({
        key: `link.${l.key}`,
        kind: "link",
        label: `Link: ${l.label}`,
      })),
    ],
    [normalizedTrackedLinks, translation],
  );

  function insertToken(key) {
    editorRef.current?.insertToken?.(key);
  }

  const trackedLinksValid =
    normalizedTrackedLinks.length === composerTrackedLinks.length &&
    new Set(normalizedTrackedLinks.map((l) => l.key)).size ===
      normalizedTrackedLinks.length;

  const cleanOpeningBody = sanitizeOpeningBody(openingBody);
  const openingMaxLength = openingInfo?.maxLength || 600;
  const openingBodyValid =
    Boolean(openingInfo) &&
    cleanOpeningBody.length > 0 &&
    cleanOpeningBody.length <= openingMaxLength;

  function normalizeTrackedLinksForStep(step) {
    return (step.trackedLinks || [])
      .map((link) => ({
        key: sanitizeTrackedKey(link.key),
        label: String(link.label || "").trim(),
        destinationUrl: String(link.destinationUrl || "").trim(),
      }))
      .filter((link) => link.key && link.label && link.destinationUrl);
  }

  function trackedLinksValidForStep(step) {
    const normalized = normalizeTrackedLinksForStep(step);

    return (
      normalized.length === (step.trackedLinks || []).length &&
      new Set(normalized.map((link) => link.key)).size === normalized.length
    );
  }

  function chainStepHasContent(step) {
    return (
      String(step.message || "").trim().length > 0 ||
      (Array.isArray(step.files) && step.files.length > 0)
    );
  }

  function normalizeDelayMinutes(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return 0;
    }

    return Math.min(Math.floor(number), MAX_CHAIN_DELAY_MINUTES);
  }

  function chainStepDelayValid(step, index) {
    if (index === 0) return true;

    const value = Number(step.delayAfterPreviousReadMinutes || 0);

    return (
      Number.isFinite(value) && value >= 0 && value <= MAX_CHAIN_DELAY_MINUTES
    );
  }

  const chainValid =
    !chainMode ||
    (readChainsFeatureEnabled &&
      channel === "whatsapp" &&
      chainSteps.length >= 2 &&
      chainSteps.length <= 10 &&
      chainSteps.every(chainStepHasContent) &&
      chainSteps.every(trackedLinksValidForStep) &&
      chainSteps.every(chainStepDelayValid));

  useEffect(() => {
    setHourDraft(formatHour(scheduledFor));
    setMinuteDraft(formatMinute(scheduledFor));
  }, [scheduledFor]);

  const commitTimeParts = useCallback(
    (hourValue, minuteValue) => {
      const rawHour = String(hourValue || "").trim();
      const rawMinute = String(minuteValue || "").trim();

      if (!rawHour || !rawMinute) {
        setTimeError("Fill in both hour and minute.");
        return false;
      }

      if (!/^\d{1,2}$/.test(rawHour) || !/^\d{1,2}$/.test(rawMinute)) {
        setTimeError("Use only numbers.");
        return false;
      }

      const hours = Number(rawHour);
      const minutes = Number(rawMinute);

      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        setTimeError("Enter a valid time.");
        return false;
      }

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        setTimeError("Enter a valid time.");
        return false;
      }

      const totalMinutes = hours * 60 + minutes;
      const minMinutes = 8 * 60;
      const maxMinutes = 20 * 60;

      if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
        setTimeError("Choose a time between 08:00 and 20:00.");
        return false;
      }

      const next = new Date(scheduledFor);
      next.setHours(hours, minutes, 0, 0);

      setScheduledFor(next);
      setHourDraft(String(hours).padStart(2, "0"));
      setMinuteDraft(String(minutes).padStart(2, "0"));
      setTimeError("");

      return true;
    },
    [scheduledFor],
  );

  function handleHourChange(value) {
    setHourDraft(
      String(value || "")
        .replace(/\D/g, "")
        .slice(0, 2),
    );
    setTimeError("");
  }

  function handleMinuteChange(value) {
    setMinuteDraft(
      String(value || "")
        .replace(/\D/g, "")
        .slice(0, 2),
    );
    setTimeError("");
  }

  useEffect(() => {
    if (!hourDraft.trim() || !minuteDraft.trim()) return;
    if (hourDraft.length < 2 || minuteDraft.length < 2) return;

    const currentHour = formatHour(scheduledFor);
    const currentMinute = formatMinute(scheduledFor);

    if (hourDraft === currentHour && minuteDraft === currentMinute) return;

    const timeout = setTimeout(() => {
      commitTimeParts(hourDraft, minuteDraft);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [commitTimeParts, hourDraft, minuteDraft, scheduledFor]);

  const hasManualContent =
    composerMessage.trim().length > 0 || composerFiles.length > 0;

  const baseCanSend =
    selected.size > 0 &&
    (isOpeningMode
      ? openingBodyValid
      : chainMode
        ? chainValid
        : trackedLinksValid && hasManualContent);

  const scheduleInvalid =
    deliveryMode === "schedule" &&
    (!scheduledFor || scheduledFor.getTime() <= Date.now() || !!timeError);

  const canSend = baseCanSend && !scheduleInvalid && !showStartMenu;

  function buildRecipients(chosen) {
    return chosen
      .filter((u) => u.phone_number || u.whatsapp_bsuid || u.bird_contact_id)
      .map((u) => ({
        userId: u.id,
        name: u.name || null,
        phoneNumber: u.phone_number || null,
        whatsappBsuid: u.whatsapp_bsuid || null,
        whatsappUsername: u.whatsapp_username || null,
        birdContactId: u.bird_contact_id || null,
      }));
  }

  function buildBroadcastPayload(chosen) {
    if (channel === "whatsapp") {
      if (isOpeningMode) {
        return {
          orgId: org?.id,
          message: "",
          imageUrls: [],
          files: [],
          trackedLinks: [],
          recipients: buildRecipients(chosen),
          openingOnly: true,
          openingBody: cleanOpeningBody,
        };
      }

      return {
        orgId: org?.id,
        message: composerMessage,
        imageUrls,
        files: composerFiles,
        trackedLinks: normalizedTrackedLinks,
        recipients: buildRecipients(chosen),
      };
    }

    return {
      orgId: org?.id,
      userIds: chosen.map((u) => u.id),
      message: composerMessage,
      files: composerFiles,
      trackedLinks: normalizedTrackedLinks,
    };
  }

  function buildChainPayload(chosen) {
    return {
      orgId: org?.id,
      createdByUserId: user?.id || null,
      channel: "whatsapp",
      recipients: buildRecipients(chosen),
      steps: chainSteps.map((step, index) => ({
        message: step.message || "",
        files: Array.isArray(step.files) ? step.files : [],
        trackedLinks: normalizeTrackedLinksForStep(step),
        delayAfterPreviousReadMinutes:
          index === 0
            ? 0
            : normalizeDelayMinutes(step.delayAfterPreviousReadMinutes),
      })),
    };
  }

  function getBroadcastCounts(data, fallbackTotal = 0) {
    if (!data || typeof data !== "object") {
      return {
        ok: fallbackTotal,
        failed: 0,
        total: fallbackTotal,
      };
    }

    const results = Array.isArray(data.results) ? data.results : [];

    const ok = Number.isFinite(Number(data.ok))
      ? Number(data.ok)
      : Number.isFinite(Number(data.successes))
        ? Number(data.successes)
        : results.length
          ? results.filter((r) => r.ok).length
          : fallbackTotal;

    const failed = Number.isFinite(Number(data.failed))
      ? Number(data.failed)
      : Number.isFinite(Number(data.failures))
        ? Number(data.failures)
        : results.length
          ? results.length - ok
          : 0;

    return {
      ok,
      failed,
      total: ok + failed,
    };
  }

  function normalizePhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function phonesMatch(a, b) {
    const da = normalizePhoneDigits(a);
    const db = normalizePhoneDigits(b);

    if (!da || !db) return false;

    return da === db || da.endsWith(db) || db.endsWith(da);
  }

  function getResultReason(result) {
    if (!result) return "Unknown error.";

    if (result.error) return String(result.error);
    if (result.reason) return String(result.reason);

    if (typeof result.data === "string" && result.data.trim()) {
      return result.data.trim();
    }

    if (result.data?.error) return String(result.data.error);
    if (result.data?.message) return String(result.data.message);
    if (result.data?.detail) return String(result.data.detail);

    if (result.status) {
      return `Request failed with status ${result.status}.`;
    }

    return "Unknown error.";
  }

  function getFailedRecipients(data, selectedUsers, channel) {
    if (!data || typeof data !== "object") return [];

    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .filter((r) => !r.ok)
      .map((r) => {
        let matchedUser = null;

        if (channel === "teams") {
          matchedUser = selectedUsers.find(
            (u) => String(u.id) === String(r.userId),
          );
        } else {
          matchedUser =
            selectedUsers.find((u) => String(u.id) === String(r.userId)) ||
            selectedUsers.find((u) =>
              phonesMatch(u.phone_number || u.phoneNumber, r.recipient || r.to),
            ) ||
            selectedUsers.find(
              (u) =>
                r.whatsappBsuid &&
                String(u.whatsapp_bsuid || u.whatsappBsuid) ===
                  String(r.whatsappBsuid),
            ) ||
            selectedUsers.find(
              (u) =>
                r.birdContactId &&
                String(u.bird_contact_id || u.birdContactId) ===
                  String(r.birdContactId),
            );
        }

        const fallbackIdentifier =
          r.recipient ||
          r.to ||
          r.whatsappUsername ||
          r.whatsappBsuid ||
          r.birdContactId ||
          r.userId ||
          r.email ||
          "Unknown recipient";

        const label =
          matchedUser?.name ||
          matchedUser?.email ||
          matchedUser?.phone_number ||
          matchedUser?.whatsapp_username ||
          matchedUser?.whatsapp_bsuid ||
          fallbackIdentifier;

        const contact =
          channel === "teams"
            ? matchedUser?.email || r.userId || ""
            : matchedUser?.phone_number ||
              matchedUser?.whatsapp_username ||
              matchedUser?.whatsapp_bsuid ||
              r.to ||
              r.recipient ||
              r.whatsappBsuid ||
              r.birdContactId ||
              "";

        return {
          label,
          contact,
          reason: getResultReason(r),
        };
      });
  }

  function formatFailedRecipients(failedRecipients, maxToShow = 8) {
    if (!failedRecipients.length) return "";

    const visible = failedRecipients.slice(0, maxToShow);

    const lines = visible.map((r) => {
      const contact =
        r.contact && String(r.contact) !== String(r.label)
          ? ` (${r.contact})`
          : "";

      return `- ${r.label}${contact}: ${r.reason}`;
    });

    const hiddenCount = failedRecipients.length - visible.length;

    if (hiddenCount > 0) {
      lines.push(`- And ${hiddenCount} more...`);
    }

    return `Failed recipients:\n${lines.join("\n")}`;
  }

  function formatBroadcastResultMessage({
    channel,
    action,
    ok,
    failed,
    note,
    failedRecipients = [],
  }) {
    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "Teams";

    const successLabel = ok === 1 ? "1 success" : `${ok} successes`;
    const failedLabel = failed === 1 ? "1 fail" : `${failed} fails`;

    const mainMessage = `${channelLabel} broadcast ${action} with ${successLabel} and ${failedLabel}.`;
    const failureDetails = formatFailedRecipients(failedRecipients);

    return [mainMessage, note, failureDetails].filter(Boolean).join("\n\n");
  }

  async function validateContentBeforeAction(action) {
    if (isOpeningMode) {
      if (openingBodyValid) return true;

      await showAlert({
        title: translation("Broadcast.alerts.openingMissing.title"),
        message: translation("Broadcast.alerts.openingMissing.message"),
        tone: "warning",
      });

      return false;
    }

    if (!hasManualContent && !chainMode) {
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
              "Message 1 was sent if the 24h window was open. If not, the opening message was sent and the chain waits for a reply.",
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

    if (!isOpeningMode && !trackedLinksValid) {
      await showAlert({
        title: "Invalid tracked links",
        message: "Please complete all tracked links and avoid duplicate keys.",
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

    if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
      await showAlert({
        title: "Choose date and time",
        message: "Choose a date and time.",
        tone: "warning",
      });
      return;
    }

    const scheduledDate = new Date(scheduledFor);
    scheduledDate.setHours(Number(hourDraft), Number(minuteDraft), 0, 0);

    if (scheduledDate.getTime() <= Date.now()) {
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
        const res = await fetch("/api/broadcast/read-chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildChainPayload(selectedUsers),
            scheduledFor: scheduledDate.toISOString(),
            timezone: browserTimeZone,
          }),
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

    if (!isOpeningMode && !trackedLinksValid) {
      await showAlert({
        title: "Invalid tracked links",
        message: "Please complete all tracked links and avoid duplicate keys.",
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

      const res = await fetch("/api/broadcast/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org?.id,
          createdByUserId: user?.id || null,
          channel,
          scheduledFor: scheduledDate.toISOString(),
          timezone: browserTimeZone,
          payload,
          recipientCount: selectedUsers.length,
        }),
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

  const allOnPageSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.id));

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

  const activeDelay = Number(
    activeChainStep?.delayAfterPreviousReadMinutes || 0,
  );

  const activeDelayParts = splitDelayMinutes(activeDelay);

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

  const schedulePanel = activeToolPanel === "schedule" && (
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
  );

  let composer = null;

  if (showStartMenu) {
    composer = (
      <StartMenu
        onChoose={setComposeMode}
        sampleName={sampleName}
        orgName={org?.name || ""}
        openingBody={openingBody}
        previewTime={previewTime}
        translation={translation}
      />
    );
  } else if (isOpeningMode) {
    composer = (
      <MessageComposer
        title={translation("Broadcast.composer.openingTitle")}
        onBack={() => setComposeMode(null)}
        showLinks={false}
        activeToolPanel={activeToolPanel}
        toggleToolPanel={toggleToolPanel}
        scheduleButtonLabel={scheduleButtonLabel}
        trackedLinksCount={0}
        translation={translation}
        phone={
          <OpeningComposer
            info={openingInfo}
            body={openingBody}
            onBodyChange={setOpeningBody}
            loading={openingLoading}
            failed={openingFailed}
            onRetry={loadOpening}
            sampleName={sampleName}
            orgName={org?.name || ""}
            previewTime={previewTime}
            translation={translation}
          />
        }
      >
        {schedulePanel}
      </MessageComposer>
    );
  } else {
    composer = (
      <MessageComposer
        title={translation("Broadcast.message")}
        onBack={isWhatsapp ? () => setComposeMode(null) : null}
        hint={translation("Broadcast.composer.hint")}
        activeToolPanel={activeToolPanel}
        toggleToolPanel={toggleToolPanel}
        scheduleButtonLabel={scheduleButtonLabel}
        trackedLinksCount={trackedLinksCount}
        translation={translation}
        leftToolsContent={chainDelayTools}
        chainControls={
          isWhatsapp ? (
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
              translation={translation}
            />
          ) : null
        }
        phone={
          <PhoneComposer
            channel={channel}
            contactName={sampleName}
            message={composerMessage}
            onMessageChange={setComposerMessage}
            editorRef={editorRef}
            tokenLabel={tokenLabel}
            variables={composerVariables}
            onInsertToken={insertToken}
            imageFiles={imageFiles}
            videoFiles={videoFiles}
            otherFiles={otherFiles}
            onRemoveFile={removeFile}
            onPickThumbnail={openThumbnailPicker}
            onRemoveThumbnail={removeThumbnail}
            onAddFile={openFilePicker}
            onAddLink={() => setActiveToolPanel("links")}
            previewTime={previewTime}
            translation={translation}
          />
        }
      >
        {schedulePanel}

        {activeToolPanel === "links" && (
          <TrackedLinksPanel
            trackedLinks={composerTrackedLinks}
            trackedLinksValid={trackedLinksValid}
            addTrackedLink={addTrackedLink}
            updateTrackedLink={updateTrackedLink}
            removeTrackedLink={removeTrackedLink}
            translation={translation}
          />
        )}
      </MessageComposer>
    );
  }

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

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        hidden
        data-testid="file-input"
        onChange={handlePickFiles}
      />

      <input
        ref={thumbInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handlePickThumbnail}
      />

      <div className={styles.columns}>
        <div className={styles.leftCol}>{composer}</div>

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
