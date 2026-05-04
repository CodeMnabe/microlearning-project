"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./broadcast.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

import BroadcastHeader from "./components/BroadcastHeader";
import MessageComposer from "./components/MessageComposer";
import AttachmentsPanel from "./components/panels/AttachmentsPanel";
import SchedulePanel from "./components/panels/SchedulePanel";
import TemplatePanel from "./components/panels/TemplatePanel";
import TrackedLinksPanel from "./components/panels/TrackedLinksPanel";
import RecipientsPanel from "./components/recipients/RecipientsPanel";

import { COMPANY_KEYS, NAME_KEYS } from "./lib/constants";
import {
  asList,
  blocksHaveUrlVariable,
  buildInitialScheduledDate,
  byBestStatus,
  extractText,
  formatHour,
  formatMinute,
  guessContentTypeFromName,
  interpolate,
  isImageContentType,
  isVideoContentType,
  makeTrackedLinkDraft,
  replaceTrackedPlaceholders,
  sanitizeTrackedKey,
} from "./lib/helpers";

export default function BroadcastPage() {
  const { user } = useAuth();
  const { org } = useOrganization(user);
  const translation = useTranslations();
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
  const [thumbForVideoUrl, setThumbForVideoUrl] = useState(null);

  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [trackedLinks, setTrackedLinks] = useState([]);
  const [selectedTrackedUrlKey, setSelectedTrackedUrlKey] = useState("");

  const [sending, setSending] = useState(false);

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

  const [channel, setChannel] = useState("teams");
  const [deliveryMode, setDeliveryMode] = useState("now");
  const [activeToolPanel, setActiveToolPanel] = useState(null);

  const initialScheduledDate = useMemo(() => buildInitialScheduledDate(), []);
  const [scheduledFor, setScheduledFor] = useState(initialScheduledDate);
  const [hourDraft, setHourDraft] = useState(() =>
    formatHour(initialScheduledDate),
  );
  const [minuteDraft, setMinuteDraft] = useState(() =>
    formatMinute(initialScheduledDate),
  );
  const [timeError, setTimeError] = useState("");

  const messageInputRef = useRef(null);

  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const imageFiles = useMemo(
    () => files.filter((f) => isImageContentType(f.contentType)),
    [files],
  );

  const videoFiles = useMemo(
    () => files.filter((f) => isVideoContentType(f.contentType)),
    [files],
  );

  const otherFiles = useMemo(
    () =>
      files.filter(
        (f) =>
          !isImageContentType(f.contentType) &&
          !isVideoContentType(f.contentType),
      ),
    [files],
  );

  const imageUrls = useMemo(() => imageFiles.map((f) => f.url), [imageFiles]);

  const trackedLinkOptions = useMemo(
    () =>
      trackedLinks
        .map((l) => ({
          value: sanitizeTrackedKey(l.key),
          label: l.key
            ? `${sanitizeTrackedKey(l.key)}${l.label ? ` — ${l.label}` : ""}`
            : "",
        }))
        .filter((l) => l.value),
    [trackedLinks],
  );

  const normalizedTrackedLinks = useMemo(
    () =>
      trackedLinks
        .map((l) => ({
          key: sanitizeTrackedKey(l.key),
          label: String(l.label || "").trim(),
          destinationUrl: String(l.destinationUrl || "").trim(),
        }))
        .filter((l) => l.key && l.label && l.destinationUrl),
    [trackedLinks],
  );

  const attachmentsCount = files.length;
  const trackedLinksCount = normalizedTrackedLinks.length;

  const getUsers = useCallback(async () => {
    if (!org?.id) return;

    const res = await fetch(`/api/users?orgId=${org.id}`);
    const data = await res.json().catch(() => ({}));
    setUsers(asList(data, "items"));
  }, [org?.id]);

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
      } catch (e) {
        console.error(e);

        if (!alive) return;
        setAssistantsList([]);
        setAllTags([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id]);

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

      const items = asList(data, "items").map((t) => ({
        ...t,
        createdAt: t.createdAt || null,
        updatedAt: t.updatedAt || null,
      }));

      setTemplates(items);

      const best = [...items].sort(byBestStatus)[0];
      if (best) {
        setTplName(best.name);
        setTplLang("pt-PT");
      }
    } catch (e) {
      setTplErr(e.message);
    } finally {
      setTplLoading(false);
      stopLoading();
    }
  }, [org?.id, stopLoading]);

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
  }, [channel, activeToolPanel]);

  const normalizedUsers = useMemo(() => {
    return (users || []).map((u) => ({
      ...u,
      id: u.id,
      name: u.name,
      phone_number: u.phone_number ?? u.phoneNumber ?? "",
      email: u.email ?? "",
      tagIds: u.tag_ids ?? (u.tags || []).map((t) => t.id),
      assistantId: u.assistant_id ?? null,
    }));
  }, [users]);

  const selectedUsers = useMemo(
    () => normalizedUsers.filter((u) => selected.has(u.id)),
    [normalizedUsers, selected],
  );

  const templatesByName = useMemo(() => {
    const m = new Map();

    for (const t of templates) {
      if (!m.has(t.name)) m.set(t.name, []);
      m.get(t.name).push(t);
    }

    for (const [k, arr] of m) {
      m.set(k, arr.sort(byBestStatus));
    }

    return m;
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
    const pt = list.find((t) =>
      (t.language || "").toLowerCase().startsWith("pt"),
    );

    setTplLang(pt?.language || list[0]?.language || "pt-PT");
  }, [tplName, templatesByName]);

  const chosenTemplate = useMemo(() => {
    const list = languagesForChosenName;

    return (
      list.find((t) => t.language === tplLang) ||
      list.find((t) => (t.language || "").toLowerCase().startsWith("pt")) ||
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

        for (const v of defs) {
          const examples = v.examplesLocale?.[tplLang]?.exampleValueStrings;
          defaults[v.key] = examples?.[0] ?? "";
        }

        setVarDefs(defs);
        setVarValues(defaults);

        const blocksForLocale =
          (data.platformContent || []).find(
            (pc) => (pc.locale || data.defaultLocale) === tplLang,
          ) || (data.platformContent || [])[0];

        setNeedsUrlVar(blocksHaveUrlVariable(blocksForLocale?.blocks || []));
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id, chosenTemplate, tplLang, channel]);

  useEffect(() => {
    if (!needsUrlVar) return;
    if (!trackedLinkOptions.length) return;
    if (selectedTrackedUrlKey) return;

    setSelectedTrackedUrlKey(trackedLinkOptions[0].value);
  }, [needsUrlVar, trackedLinkOptions, selectedTrackedUrlKey]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return normalizedUsers.filter((u) => {
      const textHay =
        `${u.name || ""} ${u.phone_number || ""} ${u.email || ""}`.toLowerCase();

      const textOk = !term || textHay.includes(term);

      const tagsOk =
        selectedTagIds.length === 0 ||
        selectedTagIds.every((id) => (u.tagIds || []).includes(id));

      const assistantOk =
        selectedAssistantIds.length === 0 ||
        selectedAssistantIds.includes(u.assistantId);

      const channelOk = channel !== "whatsapp" || !!u.phone_number;

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
    setFiles((prev) => prev.filter((f) => f.url !== url));
  }

  function addTrackedLink() {
    setTrackedLinks((prev) => [...prev, makeTrackedLinkDraft()]);
  }

  function updateTrackedLink(id, field, value) {
    setTrackedLinks((prev) =>
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
    setTrackedLinks((prev) => {
      const removed = prev.find((x) => x.id === id);
      const next = prev.filter((x) => x.id !== id);

      if (
        removed &&
        selectedTrackedUrlKey === sanitizeTrackedKey(removed.key)
      ) {
        setSelectedTrackedUrlKey("");
      }

      return next;
    });
  }

  function toggleToolPanel(panel) {
    setActiveToolPanel((prev) => (prev === panel ? null : panel));
  }

  const supabaseUpload = async (pickedFiles) => {
    const bucket = "images";
    const uploaded = [];

    const makeSafeName = (name) => {
      let safe = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safe) safe = "file";
      return safe;
    };

    for (const file of pickedFiles) {
      const safeName = makeSafeName(file.name);
      const key = `broadcasts/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}-${safeName}`;
      const ct = file.type || guessContentTypeFromName(file.name);

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(key, file, { upsert: true, contentType: ct });

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
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      alert(`${translation("Common.error")}: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        setFiles((prev) =>
          prev.map((f) =>
            f.url === thumbForVideoUrl ? { ...f, thumbnailUrl: thumb.url } : f,
          ),
        );
      }
    } catch (err) {
      alert(`${translation("Common.error")}: ${err.message}`);
    } finally {
      setThumbForVideoUrl(null);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  }

  function removeThumbnail(videoUrl) {
    setFiles((prev) =>
      prev.map((f) => (f.url === videoUrl ? { ...f, thumbnailUrl: null } : f)),
    );
  }

  const orderedParamValues = useMemo(() => {
    if (varDefs.length === 0) {
      const map = new Map(
        tplParamsManual
          .split(",")
          .map((kv) => kv.trim())
          .filter(Boolean)
          .map((kv) => {
            const [k, ...rest] = kv.split("=");
            return [k.trim(), rest.join("=").trim()];
          }),
      );

      return Array.from(map.values());
    }

    return varDefs.map((v) => (varValues[v.key] ?? "").trim());
  }, [varDefs, varValues, tplParamsManual]);

  const sampleRecipient = selectedUsers[0] || null;

  const previewVars = useMemo(() => {
    const map = {};

    for (const v of varDefs) {
      map[v.key] = varValues[v.key] ?? "";
    }

    map.recipientName = sampleRecipient?.name || map.name || map.nome || "";
    map.orgName =
      org?.name || map.empresa || map.company || map.organization || "";
    map.urlVar =
      needsUrlVar && selectedTrackedUrlKey
        ? `{{link.${selectedTrackedUrlKey}}}`
        : "";

    return map;
  }, [
    varDefs,
    varValues,
    sampleRecipient,
    org?.name,
    needsUrlVar,
    selectedTrackedUrlKey,
  ]);

  const preview = useMemo(() => {
    if (!tplDetails) {
      return { body: "", buttonText: "", buttonUrl: "" };
    }

    const pc =
      (tplDetails.platformContent || []).find(
        (x) => (x.locale || tplDetails.defaultLocale) === tplLang,
      ) || (tplDetails.platformContent || [])[0];

    const blocks = pc?.blocks?.length
      ? pc.blocks
      : tplDetails.genericContent?.[0]?.blocks || [];

    const bodyRaw = extractText(blocks).join("\n\n");
    const body = interpolate(bodyRaw, previewVars);

    let buttonText = "";
    let buttonUrl = "";

    (function scan(n) {
      if (!n) return;
      if (Array.isArray(n)) return n.forEach(scan);

      if (typeof n === "object") {
        if (n.action?.type === "link" && n.action.link) {
          buttonText = n.action.link.text || buttonText;
          buttonUrl = n.action.link.url || buttonUrl;
        }

        for (const v of Object.values(n)) {
          scan(v);
        }
      }
    })(blocks);

    buttonText = interpolate(buttonText, previewVars);
    buttonUrl = interpolate(buttonUrl, {
      ...previewVars,
      urlVar: previewVars.urlVar,
    });

    return { body, buttonText, buttonUrl };
  }, [tplDetails, tplLang, previewVars]);

  const previewMessageWithTrackedLinks = useMemo(() => {
    return replaceTrackedPlaceholders(message, normalizedTrackedLinks, channel);
  }, [message, normalizedTrackedLinks, channel]);

  const paramsComplete =
    (varDefs.length === 0 && tplParamsManual.trim().length > 0) ||
    (varDefs.length > 0 && orderedParamValues.every((v) => v !== ""));

  const trackedLinksValid =
    normalizedTrackedLinks.length === trackedLinks.length &&
    new Set(normalizedTrackedLinks.map((l) => l.key)).size ===
      normalizedTrackedLinks.length;

  const whatsappUrlBindingValid =
    !needsUrlVar ||
    trackedLinkOptions.length === 0 ||
    Boolean(selectedTrackedUrlKey);

  useEffect(() => {
    if (varDefs.length === 0) return;

    setVarValues((prev) => {
      const next = { ...prev };
      const recName = sampleRecipient?.name || "";

      for (const v of varDefs) {
        const key = v.key || "";
        const k = key.toLowerCase();

        if (!next[key]) {
          if (NAME_KEYS.includes(k)) next[key] = recName;
          if (COMPANY_KEYS.includes(k)) next[key] = org?.name || "";
        }
      }

      return next;
    });
  }, [varDefs, sampleRecipient?.name, org?.name]);

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

  const baseCanSend =
    selected.size > 0 &&
    trackedLinksValid &&
    whatsappUrlBindingValid &&
    (channel === "whatsapp"
      ? (tplName && tplLang && paramsComplete) ||
        message.trim().length > 0 ||
        files.length > 0
      : message.trim().length > 0 || files.length > 0);

  const scheduleInvalid =
    deliveryMode === "schedule" &&
    (!scheduledFor || scheduledFor.getTime() <= Date.now() || !!timeError);

  const canSend = baseCanSend && !scheduleInvalid;

  function buildBroadcastPayload(chosen) {
    if (channel === "whatsapp") {
      return {
        orgId: org?.id,
        message,
        imageUrls,
        files,
        trackedLinks: normalizedTrackedLinks,
        recipients: chosen.map((u) => u.phone_number).filter(Boolean),
        template:
          tplName && tplLang && paramsComplete
            ? {
                projectId: chosenTemplate?.projectId,
                name: tplName.trim(),
                languageCode: (tplLang || "pt-PT").trim(),
                params: orderedParamValues,
                varKeys: varDefs.length ? varDefs.map((v) => v.key) : [],
                manualParams: varDefs.length ? undefined : tplParamsManual,
                trackedUrlKey:
                  needsUrlVar && selectedTrackedUrlKey
                    ? selectedTrackedUrlKey
                    : null,
              }
            : null,
      };
    }

    return {
      orgId: org?.id,
      userIds: chosen.map((u) => u.id),
      message,
      files,
      trackedLinks: normalizedTrackedLinks,
    };
  }

  async function handleSend() {
    if (!selectedUsers.length) {
      return alert(translation("Broadcast.chooseRecipients"));
    }

    if (!trackedLinksValid) {
      return alert(
        "Please complete all tracked links and avoid duplicate keys.",
      );
    }

    if (!whatsappUrlBindingValid) {
      return alert(
        "Please choose which tracked link should be used for the WhatsApp template URL button.",
      );
    }

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
        alert(translation("Common.error"));
        return;
      }

      if (typeof data === "object" && data && data.failed > 0) {
        console.error("Broadcast partial/failed result", data);
        alert(
          `Broadcast finished with ${data.ok || 0} success and ${data.failed || 0} failed.`,
        );
        return;
      }

      alert(
        channel === "whatsapp"
          ? "WhatsApp broadcast sent successfully."
          : "Teams broadcast sent successfully.",
      );
    } catch (err) {
      console.error("[Broadcast] handleSend error:", err);
      alert(`${translation("Common.error")}: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  async function handleSchedule() {
    if (!selectedUsers.length) {
      return alert(translation("Broadcast.chooseRecipients"));
    }

    if (!trackedLinksValid) {
      return alert(
        "Please complete all tracked links and avoid duplicate keys.",
      );
    }

    if (!whatsappUrlBindingValid) {
      return alert(
        "Please choose which tracked link should be used for the WhatsApp template URL button.",
      );
    }

    const committed = commitTimeParts(hourDraft, minuteDraft);
    if (!committed) {
      return alert("Please enter a valid time between 08:00 and 20:00.");
    }

    if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
      return alert("Choose a date and time.");
    }

    if (scheduledFor.getTime() <= Date.now()) {
      return alert("The scheduled date must be in the future");
    }

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
          scheduledFor: scheduledFor.toISOString(),
          timezone: browserTimeZone,
          payload,
          recipientCount: selectedUsers.length,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Schedule broadcast error", data);
        alert(translation("Common.error"));
        return;
      }

      alert("Broadcast scheduled successfully");
      setDeliveryMode("now");
    } catch (err) {
      console.error(err);
      alert(`${translation("Common.error")}: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  function insertTrackedPlaceholder(key) {
    const token = `{{link.${key}}}`;
    const textArea = messageInputRef.current;

    if (!textArea) {
      setMessage(
        (prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${token}`,
      );
      return;
    }

    const start = textArea.selectionStart ?? message.length;
    const end = textArea.selectionEnd ?? message.length;

    const before = message.slice(0, start);
    const after = message.slice(end);

    const prefix =
      before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";

    const suffix =
      after && !after.startsWith(" ") && !after.startsWith("\n") ? " " : "";

    const inserted = `${prefix}${token}${suffix}`;
    const nextValue = before + inserted + after;

    setMessage(nextValue);

    requestAnimationFrame(() => {
      textArea.focus();
      const nextCursor = before.length + inserted.length;
      textArea.setSelectionRange(nextCursor, nextCursor);
    });
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

  const templateButtonLabel =
    channel === "whatsapp" && tplName ? tplName : "No template";

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
            message={message}
            setMessage={setMessage}
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
                files={files}
                removeFile={removeFile}
                openThumbnailPicker={openThumbnailPicker}
                removeThumbnail={removeThumbnail}
              />
            )}

            {activeToolPanel === "links" && (
              <TrackedLinksPanel
                channel={channel}
                needsUrlVar={needsUrlVar}
                trackedLinks={trackedLinks}
                trackedLinksValid={trackedLinksValid}
                trackedLinkOptions={trackedLinkOptions}
                selectedTrackedUrlKey={selectedTrackedUrlKey}
                setSelectedTrackedUrlKey={setSelectedTrackedUrlKey}
                whatsappUrlBindingValid={whatsappUrlBindingValid}
                addTrackedLink={addTrackedLink}
                updateTrackedLink={updateTrackedLink}
                removeTrackedLink={removeTrackedLink}
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
