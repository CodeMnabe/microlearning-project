"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMPANY_KEYS, NAME_KEYS } from "../lib/constants";

import {
  normalizeBroadcastUsers,
  filterBroadcastUsers,
  isReadChainValid,
  buildFallbackTemplatePayload,
  buildBroadcastPayload,
  buildReadChainPayload,

  buildInitialScheduledDate,
  formatHour,
  formatMinute,
  cleanTimeDraft,
  validateScheduleTimeParts,
  applyTimeToDate,
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
getBroadcastCounts,
getFailedRecipients,
formatBroadcastResultMessage,
getRecipientLabel,
getChannelLabel,
isFutureDate,
buildScheduledBroadcastPayload,
buildScheduledReadChainPayload,
} from "../lib/broadcast.helpers";
const EMPTY_ARRAY = [];


/**
 * Hooks locais da feature Broadcast.
 *
 * Este ficheiro concentra a lógica de frontend da página:
 * - seleção e filtragem de destinatários;
 * - agendamento;
 * - composição da mensagem;
 * - read chains de WhatsApp;
 * - templates WhatsApp;
 * - anexos;
 * - links rastreados;
 * - carregamento inicial de dados;
 * - validações e ações de envio/agendamento.
 *
 * Estes hooks não devem conter JSX de apresentação.
 * Componentes visuais ficam em components/.
 * Funções puras e construção de payloads ficam em lib/broadcast.helpers.js.
 */

// ==============================
// Recipients hook
// ==============================

/**
 * Gere destinatários e filtros do Broadcast.
 *
 * Responsabilidades:
 * - guardar a lista de utilizadores carregados;
 * - controlar pesquisa, tags e assistentes selecionados;
 * - normalizar utilizadores para o formato usado pela UI;
 * - calcular destinatários selecionados;
 * - aplicar filtros por canal, pesquisa, tags e assistentes;
 * - selecionar ou desselecionar destinatários individualmente ou em lote.
 */

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

/**
 * Gere o estado de agendamento do Broadcast.
 *
 * Controla a data, hora e minuto selecionados pelo utilizador.
 * Também valida se a data final é futura e se a hora está dentro
 * das regras permitidas pela feature.
 */

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

/**
 * Gere o conteúdo principal do composer.
 *
 * Em modo normal, guarda mensagem, ficheiros e links rastreados
 * no estado base do composer.
 *
 * Em modo read chain, redireciona essas alterações para o step ativo,
 * permitindo que cada mensagem da chain tenha texto, anexos e links próprios.
 */

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

/**
 * Gere o estado das read chains de WhatsApp.
 *
 * Uma read chain é uma sequência de mensagens freeform enviada
 * com base em leituras/respostas, usando um template WhatsApp como fallback
 * quando a janela de 24h não está aberta.
 *
 * Este hook controla:
 * - ativação do modo chain;
 * - step ativo;
 * - criação, duplicação e remoção de steps;
 * - atraso entre mensagens após leitura;
 * - limite mínimo e máximo de mensagens da chain.
 */

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

/**
 * Gere templates WhatsApp disponíveis para a organização.
 *
 * Responsabilidades:
 * - carregar templates aprovados/disponíveis;
 * - escolher automaticamente o melhor template inicial;
 * - carregar detalhes do template selecionado;
 * - preparar variáveis e valores por defeito;
 * - detetar se o template precisa de URL button;
 * - gerar preview do template;
 * - validar se os parâmetros obrigatórios estão completos.
 */

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

/**
 * Gere anexos do composer.
 *
 * Responsabilidades:
 * - fazer upload de ficheiros para o storage;
 * - separar ficheiros por tipo: imagens, vídeos e outros;
 * - expor URLs de imagem para payloads de envio;
 * - gerir thumbnails de vídeos;
 * - remover ficheiros e thumbnails.
 */

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

/**
 * Gere links rastreados usados no Broadcast.
 *
 * Responsabilidades:
 * - criar, editar e remover links rastreados;
 * - normalizar keys e URLs;
 * - validar links incompletos ou duplicados;
 * - substituir placeholders no preview da mensagem;
 * - garantir ligação entre tracked link e botão URL de templates WhatsApp.
 */

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

// ==============================
// Bootstrap data hook
// ==============================

/**
 * Carrega dados iniciais necessários para a página Broadcast.
 *
 * Responsabilidades:
 * - carregar utilizadores da organização;
 * - carregar tags e assistentes usados nos filtros;
 * - verificar se a organização tem read chains ativas;
 * - carregar templates quando o canal selecionado é WhatsApp;
 * - terminar o loader global quando os dados principais estão prontos.
 *
 * Este hook centraliza fetches iniciais para manter a page limpa.
 */

export function useBroadcastBootstrapData({
  orgId,
  channel,

  setUsers,
  setAllTags,
  setAssistantsList,
  setReadChainsFeatureEnabled,

  loadTemplates,
  showAlert,
  translation,
  stopLoading,
}) {
  const showAlertRef = useRef(showAlert);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const getUsers = useCallback(async () => {
    if (!orgId) return;

    try {
      const res = await fetch(`/api/users?orgId=${orgId}`);
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
  }, [orgId, setUsers, translation]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      try {
        const [assistantsData, tagsData] = await Promise.all([
          fetch(`/api/assistants?orgId=${orgId}`).then((res) => res.json()),
          fetch(`/api/tags?orgId=${orgId}`).then((res) => res.json()),
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
  }, [orgId, setAssistantsList, setAllTags, translation]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/messaging-feature?orgId=${orgId}&channel=whatsapp`,
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
  }, [orgId, setReadChainsFeatureEnabled]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      await getUsers();

      if (channel === "whatsapp") {
        await loadTemplates();
      }

      if (alive) {
        stopLoading?.();
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId, channel, getUsers, loadTemplates, stopLoading]);

  return {
    refreshUsers: getUsers,
  };
}


// ==============================
// Channel guards hook
// ==============================

/**
 * Aplica regras quando o canal de envio muda.
 *
 * Exemplos:
 * - fecha o painel de template quando o canal é Teams;
 * - desativa read chains quando o canal deixa de ser WhatsApp.
 *
 * Estas proteções evitam estados inválidos na interface.
 */

export function useBroadcastChannelGuards({
  channel,
  activeToolPanel,
  setActiveToolPanel,
  chainMode,
  setChainMode,
}) {
  useEffect(() => {
    if (channel === "teams" && activeToolPanel === "template") {
      setActiveToolPanel(null);
    }

    if (channel !== "whatsapp" && chainMode) {
      setChainMode(false);
    }
  }, [channel, activeToolPanel, setActiveToolPanel, chainMode, setChainMode]);
}

// ==============================
// Derived state hook
// ==============================

/**
 * Calcula estado derivado necessário para envio e agendamento.
 *
 * Responsabilidades:
 * - verificar se existe template fallback válido;
 * - validar se a read chain está completa;
 * - calcular se o botão principal pode ser ativado;
 * - construir payloads de broadcast normal;
 * - construir payloads de read chain.
 *
 * Este hook não envia dados.
 * Apenas prepara valores e funções usados pelas ações principais.
 */

export function useBroadcastDerivedState({
  channel,
  orgId,
  createdByUserId,

  selectedCount,
  scheduleInvalid,

  chainMode,
  readChainsFeatureEnabled,
  chainSteps,

  tplName,
  tplLang,
  paramsComplete,
  chosenTemplate,
  orderedParamValues,
  varDefs,
  tplParamsManual,
  needsUrlVar,

  composerMessage,
  composerFiles,
  composerSelectedTrackedUrlKey,

  imageUrls,
  normalizedTrackedLinks,
  trackedLinksValid,
  whatsappUrlBindingValid,
}) {
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
    selectedCount > 0 &&
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

  const getFallbackTemplatePayload = useCallback(() => {
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
  }, [
    chosenTemplate,
    tplName,
    tplLang,
    paramsComplete,
    orderedParamValues,
    varDefs,
    tplParamsManual,
    needsUrlVar,
    composerSelectedTrackedUrlKey,
  ]);

  const buildBroadcastPayloadForRecipients = useCallback(
    (chosen) => {
      return buildBroadcastPayload({
        channel,
        orgId,
        users: chosen,
        message: composerMessage,
        imageUrls,
        files: composerFiles,
        trackedLinks: normalizedTrackedLinks,
        template: getFallbackTemplatePayload(),
      });
    },
    [
      channel,
      orgId,
      composerMessage,
      imageUrls,
      composerFiles,
      normalizedTrackedLinks,
      getFallbackTemplatePayload,
    ],
  );

  const buildChainPayloadForRecipients = useCallback(
    (chosen) => {
      return buildReadChainPayload({
        orgId,
        createdByUserId,
        users: chosen,
        fallbackTemplate: getFallbackTemplatePayload(),
        steps: chainSteps,
      });
    },
    [orgId, createdByUserId, getFallbackTemplatePayload, chainSteps],
  );

  return {
    hasFallbackTemplate,
    chainValid,
    canSend,

    getFallbackTemplatePayload,
    buildBroadcastPayload: buildBroadcastPayloadForRecipients,
    buildChainPayload: buildChainPayloadForRecipients,
  };
}
// ==============================
// Actions hook
// ==============================
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
          counts.failed > 0 ? "Broadcast completed with issues" : "Broadcast sent",
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

// ==============================
// Tracked placeholder insertion hook
// ==============================

/**
 * Gere a inserção de placeholders de links rastreados no composer.
 *
 * Insere tokens no formato {{link.key}} na posição atual do cursor.
 * Quando a textarea não está ativa, adiciona o token ao fim da mensagem.
 *
 * Também preserva espaços antes/depois do token e reposiciona o cursor
 * após a inserção.
 */

export function useTrackedPlaceholderInsertion({
  composerMessage,
  setComposerMessage,
}) {
  const messageInputRef = useRef(null);

  const insertTrackedPlaceholder = useCallback(
    (key) => {
      const token = `{{link.${key}}}`;
      const textArea = messageInputRef.current;
      const currentMessage =
        typeof composerMessage === "string" ? composerMessage : "";

      if (!textArea) {
        setComposerMessage(
          (prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${token}`,
        );

        return;
      }

      const start = textArea.selectionStart ?? currentMessage.length;
      const end = textArea.selectionEnd ?? currentMessage.length;

      const before = currentMessage.slice(0, start);
      const after = currentMessage.slice(end);

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
    },
    [composerMessage, setComposerMessage],
  );

  return {
    messageInputRef,
    insertTrackedPlaceholder,
  };
}

// ==============================
// UI state hook
// ==============================

/**
 * Prepara pequenos valores derivados usados pela UI.
 *
 * Exemplos:
 * - hora apresentada no preview do template;
 * - label do botão de agendamento;
 * - label do botão de template.
 *
 * Mantém estes cálculos fora da page para reduzir ruído visual.
 */

export function useBroadcastUiState({
  deliveryMode,
  scheduledFor,
  channel,
  tplName,
  translation,
}) {
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

  return {
    previewTime,
    scheduleButtonLabel,
    templateButtonLabel,
  };
}