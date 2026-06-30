"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMPANY_KEYS, NAME_KEYS } from "../lib/constants";

import {
  normalizeBroadcastUsers,
  filterBroadcastUsers,

  buildInitialScheduledDate,
  formatHour,
  formatMinute,
  cleanTimeDraft,
  validateScheduleTimeParts,
  applyTimeToDate,
  isFutureDate,
  getScheduledDateFromDraft,

  isImageContentType,
  isVideoContentType,
  uploadBroadcastFiles,

  makeTrackedLinkDraft,
  sanitizeTrackedKey,
  replaceTrackedPlaceholders,
  getTrackedLinkOptions,
  normalizeComposerTrackedLinks,
  areComposerTrackedLinksValid,
  isWhatsappUrlBindingValid,

  makeChainStep,
  normalizeDelayMinutes,
  splitDelayMinutes,
  clampNumber,
  MAX_CHAIN_DELAY_HOURS,
  asList,
blocksHaveUrlVariable,
byBestStatus,
getOrderedTemplateParamValues,
buildTemplatePreviewVars,
buildTemplatePreview,
areTemplateParamsComplete,
} from "../lib/broadcast.helpers";
const EMPTY_ARRAY = [];


// ==============================
// Recipients hook
// ==============================

export function useBroadcastRecipients({ channel }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [allTags, setAllTags] = useState([]);
  const [assistantsList, setAssistantsList] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedAssistantIds, setSelectedAssistantIds] = useState([]);

  const activeFilterCount =
    selectedTagIds.length + selectedAssistantIds.length;

  const normalizedUsers = useMemo(
    () => normalizeBroadcastUsers(users),
    [users],
  );

  const selectedUsers = useMemo(
    () => normalizedUsers.filter((user) => selected.has(user.id)),
    [normalizedUsers, selected],
  );

  const filtered = useMemo(
    () =>
      filterBroadcastUsers({
        users: normalizedUsers,
        query: q,
        selectedTagIds,
        selectedAssistantIds,
        channel,
      }),
    [normalizedUsers, q, selectedTagIds, selectedAssistantIds, channel],
  );

  const allOnPageSelected = useMemo(
    () => filtered.length > 0 && filtered.every((user) => selected.has(user.id)),
    [filtered, selected],
  );

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllCurrent() {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = filtered.map((user) => user.id);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));

      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  return {
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
  };
}



// ==============================
// Schedule hook
// ==============================

export function useBroadcastSchedule({ deliveryMode }) {
  const initialScheduledDate = useMemo(() => buildInitialScheduledDate(), []);

  const [scheduledFor, setScheduledFor] = useState(initialScheduledDate);
  const [hourDraft, setHourDraft] = useState(() =>
    formatHour(initialScheduledDate),
  );
  const [minuteDraft, setMinuteDraft] = useState(() =>
    formatMinute(initialScheduledDate),
  );
  const [timeError, setTimeError] = useState("");

  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const commitTimeParts = useCallback(
    (hourValue, minuteValue) => {
      const validation = validateScheduleTimeParts(hourValue, minuteValue);

      if (!validation.ok) {
        setTimeError(validation.error);
        return false;
      }

      const { hours, minutes } = validation;

      const next = applyTimeToDate(scheduledFor, hours, minutes);

      setScheduledFor(next);
      setHourDraft(String(hours).padStart(2, "0"));
      setMinuteDraft(String(minutes).padStart(2, "0"));
      setTimeError("");

      return true;
    },
    [scheduledFor],
  );

  function handleHourChange(value) {
    setHourDraft(cleanTimeDraft(value));
    setTimeError("");
  }

  function handleMinuteChange(value) {
    setMinuteDraft(cleanTimeDraft(value));
    setTimeError("");
  }

  useEffect(() => {
    setHourDraft(formatHour(scheduledFor));
    setMinuteDraft(formatMinute(scheduledFor));
  }, [scheduledFor]);

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

  const scheduledDateFromDraft = useMemo(
    () => getScheduledDateFromDraft(scheduledFor, hourDraft, minuteDraft),
    [scheduledFor, hourDraft, minuteDraft],
  );

  const scheduleInvalid =
    deliveryMode === "schedule" &&
    (!scheduledDateFromDraft ||
      !isFutureDate(scheduledDateFromDraft) ||
      !!timeError);

  return {
    scheduledFor,
    setScheduledFor,

    hourDraft,
    minuteDraft,

    timeError,
    setTimeError,

    browserTimeZone,
    scheduledDateFromDraft,
    scheduleInvalid,

    commitTimeParts,
    handleHourChange,
    handleMinuteChange,
  };
}






// ==============================
// Composer hook
// ==============================

export function useBroadcastComposer({
  chainMode,
  chainSteps,
  setChainSteps,
  activeChainStepIndex,
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [trackedLinks, setTrackedLinks] = useState([]);
  const [selectedTrackedUrlKey, setSelectedTrackedUrlKey] = useState("");

  const activeChainStep = chainSteps[activeChainStepIndex] || chainSteps[0];

  const activeChainStepFiles = activeChainStep?.files || EMPTY_ARRAY;
  const activeChainStepTrackedLinks =
    activeChainStep?.trackedLinks || EMPTY_ARRAY;

  const composerMessage = chainMode ? activeChainStep?.message || "" : message;
  const composerFiles = chainMode ? activeChainStepFiles : files;
  const composerTrackedLinks = chainMode
    ? activeChainStepTrackedLinks
    : trackedLinks;
  const composerSelectedTrackedUrlKey = chainMode
    ? activeChainStep?.selectedTrackedUrlKey || ""
    : selectedTrackedUrlKey;

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
    [activeChainStepIndex, setChainSteps],
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

  const setComposerSelectedTrackedUrlKey = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setSelectedTrackedUrlKey(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        selectedTrackedUrlKey:
          typeof nextValue === "function"
            ? nextValue(step.selectedTrackedUrlKey || "")
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  return {
    message,
    setMessage,

    files,
    setFiles,

    trackedLinks,
    setTrackedLinks,

    selectedTrackedUrlKey,
    setSelectedTrackedUrlKey,

    activeChainStep,
    activeChainStepFiles,
    activeChainStepTrackedLinks,

    composerMessage,
    composerFiles,
    composerTrackedLinks,
    composerSelectedTrackedUrlKey,

    updateActiveChainStep,
    setComposerMessage,
    setComposerFiles,
    setComposerTrackedLinks,
    setComposerSelectedTrackedUrlKey,
  };
}


// ==============================
// Read chains hook
// ==============================

export function useBroadcastChains() {
  const [readChainsFeatureEnabled, setReadChainsFeatureEnabled] =
    useState(false);

  const [chainMode, setChainMode] = useState(false);
  const [activeChainStepIndex, setActiveChainStepIndex] = useState(0);

  const [chainSteps, setChainSteps] = useState(() => [
    makeChainStep(),
    makeChainStep(),
  ]);

  const addChainStep = useCallback(() => {
    setChainSteps((prev) => {
      if (prev.length >= 10) return prev;

      const next = [...prev, makeChainStep()];
      setActiveChainStepIndex(next.length - 1);

      return next;
    });
  }, []);

  const duplicateChainStep = useCallback(() => {
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
        selectedTrackedUrlKey: current.selectedTrackedUrlKey || "",
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
  }, [activeChainStepIndex]);

  const removeChainStep = useCallback((indexToRemove) => {
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
  }, []);

  const updateChainStepDelay = useCallback((indexToUpdate, value) => {
    const delay = normalizeDelayMinutes(value);

    setChainSteps((prev) =>
      prev.map((step, index) => {
        if (index !== indexToUpdate) return step;

        return {
          ...step,
          delayAfterPreviousReadMinutes: index === 0 ? 0 : delay,
        };
      }),
    );
  }, []);

  const updateChainStepDelayPart = useCallback(
    (indexToUpdate, part, value) => {
      if (indexToUpdate === 0) return;

      const currentStep = chainSteps[indexToUpdate] || {};
      const currentDelay = Number(
        currentStep.delayAfterPreviousReadMinutes || 0,
      );

      const current = splitDelayMinutes(currentDelay);

      const nextHours =
        part === "hours"
          ? clampNumber(value, 0, MAX_CHAIN_DELAY_HOURS)
          : current.hours;

      const nextMinutes =
        part === "minutes" ? clampNumber(value, 0, 59) : current.minutes;

      updateChainStepDelay(indexToUpdate, nextHours * 60 + nextMinutes);
    },
    [chainSteps, updateChainStepDelay],
  );

  const activeDelay = useMemo(() => {
    const activeStep = chainSteps[activeChainStepIndex] || chainSteps[0];

    return Number(activeStep?.delayAfterPreviousReadMinutes || 0);
  }, [chainSteps, activeChainStepIndex]);

  const activeDelayParts = useMemo(
    () => splitDelayMinutes(activeDelay),
    [activeDelay],
  );

  return {
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

    updateChainStepDelay,
    updateChainStepDelayPart,

    activeDelay,
    activeDelayParts,
  };
}







// ==============================
// Templates hook
// ==============================


export function useBroadcastTemplates({
  org,
  channel,
  selectedUsers,
  composerSelectedTrackedUrlKey,
  setSelectedTrackedUrlKey,
  showAlert,
  translation,
  stopLoading,
}) {
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState(null);

  const [tplName, setTplName] = useState("");
  const [tplLang, setTplLang] = useState("pt-PT");

  const [tplDetails, setTplDetails] = useState(null);
  const [varDefs, setVarDefs] = useState([]);
  const [varValues, setVarValues] = useState({});
  const [needsUrlVar, setNeedsUrlVar] = useState(false);
  const [tplParamsManual, setTplParamsManual] = useState("");

  const loadTemplates = useCallback(async () => {
    if (!org?.id) return;

    setTplLoading(true);
    setTplErr(null);

    try {
      const res = await fetch(`/api/template/list?orgId=${org.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch templates");
      }

      const items = asList(data, "items").map((template) => ({
        ...template,
        createdAt: template.createdAt || null,
        updatedAt: template.updatedAt || null,
      }));

      setTemplates(items);

      const best = [...items].sort(byBestStatus)[0];

      if (best) {
        setTplName(best.name);
        setTplLang("pt-PT");
      }
    } catch (err) {
      console.warn("[Broadcast] templates load error:", err);

      setTplErr(err.message);

      await showAlert({
        title: translation("Broadcast.alerts.templatesLoadFailed.title"),
        message: translation("Broadcast.alerts.templatesLoadFailed.message"),
        tone: "danger",
      });
    } finally {
      setTplLoading(false);
      stopLoading?.();
    }
  }, [org?.id, showAlert, stopLoading, translation]);

  const templatesByName = useMemo(() => {
    const map = new Map();

    for (const template of templates) {
      if (!map.has(template.name)) {
        map.set(template.name, []);
      }

      map.get(template.name).push(template);
    }

    for (const [key, items] of map) {
      map.set(key, items.sort(byBestStatus));
    }

    return map;
  }, [templates]);

  const nameOptions = useMemo(
    () => Array.from(templatesByName.keys()).sort((a, b) => a.localeCompare(b)),
    [templatesByName],
  );

  const languagesForChosenName = useMemo(
    () => (tplName ? templatesByName.get(tplName) || [] : []),
    [tplName, templatesByName],
  );

  useEffect(() => {
    if (!tplName) return;

    const list = templatesByName.get(tplName) || [];

    const pt = list.find((template) =>
      (template.language || "").toLowerCase().startsWith("pt"),
    );

    setTplLang(pt?.language || list[0]?.language || "pt-PT");
  }, [tplName, templatesByName]);

  const chosenTemplate = useMemo(() => {
    const list = languagesForChosenName;

    return (
      list.find((template) => template.language === tplLang) ||
      list.find((template) =>
        (template.language || "").toLowerCase().startsWith("pt"),
      ) ||
      list[0] ||
      null
    );
  }, [languagesForChosenName, tplLang]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setTplDetails(null);
      setVarDefs([]);
      setVarValues({});
      setNeedsUrlVar(false);
      setSelectedTrackedUrlKey("");

      if (!org?.id || !chosenTemplate || channel !== "whatsapp") return;

      try {
        const res = await fetch(
          `/api/template?orgId=${org.id}&projectId=${chosenTemplate.projectId}&id=${chosenTemplate.id}`,
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch template");
        }

        if (!alive) return;

        setTplDetails(data);

        const defs = Array.isArray(data.variables) ? data.variables : [];
        const defaults = {};

        for (const variable of defs) {
          const examples =
            variable.examplesLocale?.[tplLang]?.exampleValueStrings;

          defaults[variable.key] = examples?.[0] ?? "";
        }

        setVarDefs(defs);
        setVarValues(defaults);

        const blocksForLocale =
          (data.platformContent || []).find(
            (item) => (item.locale || data.defaultLocale) === tplLang,
          ) || (data.platformContent || [])[0];

        setNeedsUrlVar(blocksHaveUrlVariable(blocksForLocale?.blocks || []));
      } catch (err) {
        console.warn("[Broadcast] template details load error:", err);

        if (!alive) return;

        await showAlert({
          title: translation("Broadcast.alerts.templateDetailsFailed.title"),
          message: translation(
            "Broadcast.alerts.templateDetailsFailed.message",
          ),
          tone: "danger",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    org?.id,
    chosenTemplate,
    tplLang,
    channel,
    setSelectedTrackedUrlKey,
    showAlert,
    translation,
  ]);

  const orderedParamValues = useMemo(
    () =>
      getOrderedTemplateParamValues({
        varDefs,
        varValues,
        manualParams: tplParamsManual,
      }),
    [varDefs, varValues, tplParamsManual],
  );

  const sampleRecipient = selectedUsers[0] || null;

  const previewVars = useMemo(
    () =>
      buildTemplatePreviewVars({
        varDefs,
        varValues,
        sampleRecipient,
        orgName: org?.name,
        needsUrlVar,
        selectedTrackedUrlKey: composerSelectedTrackedUrlKey,
      }),
    [
      varDefs,
      varValues,
      sampleRecipient,
      org?.name,
      needsUrlVar,
      composerSelectedTrackedUrlKey,
    ],
  );

  const preview = useMemo(
    () =>
      buildTemplatePreview({
        tplDetails,
        tplLang,
        previewVars,
      }),
    [tplDetails, tplLang, previewVars],
  );

  const paramsComplete = useMemo(
    () =>
      areTemplateParamsComplete({
        varDefs,
        manualParams: tplParamsManual,
        orderedParamValues,
      }),
    [varDefs, tplParamsManual, orderedParamValues],
  );

  useEffect(() => {
    if (varDefs.length === 0) return;

    setVarValues((prev) => {
      const next = { ...prev };
      const recipientName = sampleRecipient?.name || "";

      for (const variable of varDefs) {
        const key = variable.key || "";
        const lowerKey = key.toLowerCase();

        if (!next[key]) {
          if (NAME_KEYS.includes(lowerKey)) {
            next[key] = recipientName;
          }

          if (COMPANY_KEYS.includes(lowerKey)) {
            next[key] = org?.name || "";
          }
        }
      }

      return next;
    });
  }, [varDefs, sampleRecipient?.name, org?.name]);

  return {
    templates,
    setTemplates,

    tplLoading,
    setTplLoading,

    tplErr,
    setTplErr,

    tplName,
    setTplName,

    tplLang,
    setTplLang,

    tplDetails,
    setTplDetails,

    varDefs,
    setVarDefs,

    varValues,
    setVarValues,

    needsUrlVar,
    setNeedsUrlVar,

    tplParamsManual,
    setTplParamsManual,

    templatesByName,
    nameOptions,
    languagesForChosenName,
    chosenTemplate,

    orderedParamValues,
    sampleRecipient,
    previewVars,
    preview,
    paramsComplete,

    loadTemplates,
  };
}



// ==============================
// Attachments hook
// ==============================

export function useBroadcastAttachments({
  supabase,
  composerFiles,
  setComposerFiles,
  showAlert,
  translation,
}) {
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const [thumbForVideoUrl, setThumbForVideoUrl] = useState(null);

  const imageFiles = useMemo(
    () => composerFiles.filter((file) => isImageContentType(file.contentType)),
    [composerFiles],
  );

  const videoFiles = useMemo(
    () => composerFiles.filter((file) => isVideoContentType(file.contentType)),
    [composerFiles],
  );

  const otherFiles = useMemo(
    () =>
      composerFiles.filter(
        (file) =>
          !isImageContentType(file.contentType) &&
          !isVideoContentType(file.contentType),
      ),
    [composerFiles],
  );

  const imageUrls = useMemo(
    () => imageFiles.map((file) => file.url),
    [imageFiles],
  );

  const attachmentsCount = composerFiles.length;

  const supabaseUpload = useCallback(
    async (pickedFiles) => {
      return uploadBroadcastFiles({
        supabase,
        files: pickedFiles,
      });
    },
    [supabase],
  );

  const removeFile = useCallback(
    (url) => {
      setComposerFiles((prev) => prev.filter((file) => file.url !== url));
    },
    [setComposerFiles],
  );

  const handlePickFiles = useCallback(
    async (event) => {
      const picked = Array.from(event.target.files || []);

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
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [setComposerFiles, showAlert, supabaseUpload, translation],
  );

  const openThumbnailPicker = useCallback((videoUrl) => {
    setThumbForVideoUrl(videoUrl);

    setTimeout(() => {
      thumbInputRef.current?.click?.();
    }, 0);
  }, []);

  const handlePickThumbnail = useCallback(
    async (event) => {
      const picked = Array.from(event.target.files || []);

      if (!picked.length || !thumbForVideoUrl) {
        if (thumbInputRef.current) {
          thumbInputRef.current.value = "";
        }

        return;
      }

      try {
        const uploaded = await supabaseUpload([picked[0]]);
        const thumb = uploaded[0];

        if (thumb?.url) {
          setComposerFiles((prev) =>
            prev.map((file) =>
              file.url === thumbForVideoUrl
                ? { ...file, thumbnailUrl: thumb.url }
                : file,
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

        if (thumbInputRef.current) {
          thumbInputRef.current.value = "";
        }
      }
    },
    [
      setComposerFiles,
      showAlert,
      supabaseUpload,
      thumbForVideoUrl,
      translation,
    ],
  );

  const removeThumbnail = useCallback(
    (videoUrl) => {
      setComposerFiles((prev) =>
        prev.map((file) =>
          file.url === videoUrl ? { ...file, thumbnailUrl: null } : file,
        ),
      );
    },
    [setComposerFiles],
  );

  return {
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
  };
}

// ==============================
// Tracked links hook
// ==============================

export function useBroadcastTrackedLinks({
  channel,
  composerMessage,
  composerTrackedLinks,
  setComposerTrackedLinks,
  needsUrlVar,
  composerSelectedTrackedUrlKey,
  setComposerSelectedTrackedUrlKey,
  showAlert,
  translation,
}) {
  const trackedLinkOptions = useMemo(
    () => getTrackedLinkOptions(composerTrackedLinks),
    [composerTrackedLinks],
  );

  const normalizedTrackedLinks = useMemo(
    () => normalizeComposerTrackedLinks(composerTrackedLinks),
    [composerTrackedLinks],
  );

  const trackedLinksCount = normalizedTrackedLinks.length;

  const trackedLinksValid = useMemo(
    () => areComposerTrackedLinksValid(composerTrackedLinks),
    [composerTrackedLinks],
  );

  const whatsappUrlBindingValid = useMemo(
    () =>
      isWhatsappUrlBindingValid({
        needsUrlVar,
        trackedLinkOptions,
        selectedTrackedUrlKey: composerSelectedTrackedUrlKey,
      }),
    [needsUrlVar, trackedLinkOptions, composerSelectedTrackedUrlKey],
  );

  const previewMessageWithTrackedLinks = useMemo(() => {
    return replaceTrackedPlaceholders(
      composerMessage,
      normalizedTrackedLinks,
      channel,
    );
  }, [composerMessage, normalizedTrackedLinks, channel]);

  useEffect(() => {
    if (!needsUrlVar) return;
    if (!trackedLinkOptions.length) return;
    if (composerSelectedTrackedUrlKey) return;

    setComposerSelectedTrackedUrlKey(trackedLinkOptions[0].value);
  }, [
    needsUrlVar,
    trackedLinkOptions,
    composerSelectedTrackedUrlKey,
    setComposerSelectedTrackedUrlKey,
  ]);

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
    const removed = composerTrackedLinks.find((link) => link.id === id);

    const removedSelectedUrlLink =
      removed &&
      composerSelectedTrackedUrlKey === sanitizeTrackedKey(removed.key);

    setComposerTrackedLinks((prev) => prev.filter((link) => link.id !== id));

    if (removedSelectedUrlLink) {
      setComposerSelectedTrackedUrlKey("");

      void showAlert({
        title: translation("Broadcast.alerts.trackedLinkRemoved.title"),
        message: translation("Broadcast.alerts.trackedLinkRemoved.message"),
        tone: "warning",
      });
    }
  }

  return {
    trackedLinkOptions,
    normalizedTrackedLinks,
    trackedLinksCount,
    trackedLinksValid,
    whatsappUrlBindingValid,
    previewMessageWithTrackedLinks,

    addTrackedLink,
    updateTrackedLink,
    removeTrackedLink,
  };
}