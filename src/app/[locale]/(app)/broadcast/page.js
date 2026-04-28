/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import {
  Filter,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  CalendarDays,
  MessageSquareText,
} from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./broadcast.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import FilterMenu from "@/app/[locale]/(app)/users/FilterMenu";

function getInitial(name = "") {
  return (name?.trim()?.[0] || "?").toUpperCase();
}

function asList(data, preferredKey = "items") {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[preferredKey])) return data[preferredKey];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;
  return [];
}

function buildInitialScheduledDate() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

function formatHour(date) {
  return String(date.getHours()).padStart(2, "0");
}

function formatMinute(date) {
  return String(date.getMinutes()).padStart(2, "0");
}

function makeTrackedLinkDraft() {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    key: "",
    label: "",
    destinationUrl: "",
  };
}

const NAME_KEYS = [
  "name",
  "nome",
  "firstname",
  "first_name",
  "utilizador",
  "user",
];

const COMPANY_KEYS = [
  "empresa",
  "company",
  "organization",
  "organização",
  "organizacao",
  "org",
  "orgname",
  "companyname",
  "organizationname",
];

const STATUS_RANK = {
  ACTIVE: 4,
  PENDING: 3,
  PENDINGREVIEW: 3,
  DRAFT: 2,
  INACTIVE: 1,
};

const isLockedVar = (key) => {
  const k = String(key || "").toLowerCase();
  return NAME_KEYS.includes(k) || COMPANY_KEYS.includes(k);
};

const byBestStatus = (a, b) => {
  const ra = STATUS_RANK[a.status] || 0;
  const rb = STATUS_RANK[b.status] || 0;
  if (ra !== rb) return rb - ra;

  const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return tb - ta;
};

function interpolate(str, values) {
  if (!str) return "";

  return str.replace(/\{\{\s*([.\w-]+)\s*\}\}/g, (_, rawKey) => {
    const k = String(rawKey).toLowerCase();

    if (NAME_KEYS.includes(k)) {
      return values.recipientName ?? values[rawKey] ?? values[k] ?? "";
    }

    if (COMPANY_KEYS.includes(k)) {
      return values.orgName ?? values[rawKey] ?? values[k] ?? "";
    }

    return values[rawKey] ?? values[k] ?? "";
  });
}

function extractText(node, out = []) {
  if (!node) return out;

  if (Array.isArray(node)) {
    node.forEach((n) => extractText(n, out));
    return out;
  }

  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (
        typeof v === "string" &&
        (k === "text" || k === "title" || k === "content")
      ) {
        out.push(v);
      } else {
        extractText(v, out);
      }
    }
  }

  return out;
}

function blocksHaveUrlVariable(blocks) {
  const visit = (n) => {
    if (!n) return false;
    if (Array.isArray(n)) return n.some(visit);

    if (typeof n === "object") {
      for (const [k, v] of Object.entries(n)) {
        if (k === "url" && typeof v === "string" && v.includes("{{")) {
          return true;
        }
        if (visit(v)) return true;
      }
    }

    return false;
  };

  return visit(blocks);
}

function isImageContentType(ct = "") {
  return String(ct).toLowerCase().startsWith("image/");
}

function isVideoContentType(ct = "") {
  return String(ct).toLowerCase().startsWith("video/");
}

function guessContentTypeFromName(name = "") {
  const n = String(name || "").toLowerCase();

  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";

  return "application/octet-stream";
}

function sanitizeTrackedKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function replaceTrackedPlaceholders(
  str = "",
  trackedLinks = [],
  channel = "teams",
) {
  let out = String(str || "");

  for (const link of trackedLinks) {
    const placeholder = `{{link.${link.key}}}`;
    const replacement =
      channel === "teams"
        ? `[${link.label || link.key}](${placeholder})`
        : placeholder;

    out = out.split(placeholder).join(replacement);
  }

  return out;
}

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
      const key = `broadcasts/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
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
      ? `${scheduledFor.toLocaleDateString()} ${formatHour(scheduledFor)}:${formatMinute(scheduledFor)}`
      : translation("Broadcast.sendnow");

  const templateButtonLabel =
    channel === "whatsapp" && tplName ? tplName : "No template";

  return (
    <div className={styles.screen}>
      <div className={styles.headerRow}>
        <div className={styles.channelSwitch}>
          <button
            type="button"
            className={`${styles.channelBtn} ${
              channel === "teams" ? styles.channelBtnActive : ""
            }`}
            onClick={() => setChannel("teams")}
          >
            Teams
          </button>

          <button
            type="button"
            className={`${styles.channelBtn} ${
              channel === "whatsapp" ? styles.channelBtnActive : ""
            }`}
            onClick={() => setChannel("whatsapp")}
          >
            WhatsApp
          </button>
        </div>

        <div className={styles.actionsRight}>
          <div className={styles.selectedLabel}>
            {translation("Broadcast.selected")} <strong>{selected.size}</strong>
          </div>

          <button
            onClick={deliveryMode === "schedule" ? handleSchedule : handleSend}
            disabled={sending || !canSend}
            className={styles.primaryBtn}
          >
            {sending
              ? translation("Broadcast.sending")
              : deliveryMode === "schedule"
                ? "Schedule"
                : translation("Broadcast.send")}
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.leftCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>
              {translation("Broadcast.message")}
            </div>

            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              placeholder={translation("Broadcast.messagePlaceholder")}
              className={styles.textarea}
            />

            {normalizedTrackedLinks.length > 0 && (
              <div className={styles.placeholderHint}>
                <div className={styles.placeholderHintTitle}>
                  Tracked placeholders:
                </div>
                {normalizedTrackedLinks.map((link) => {
                  const token = `{{link.${link.key}}}`;

                  return (
                    <button
                      key={link.key}
                      type="button"
                      className={styles.placeholderInsertBtn}
                      onClick={() => insertTrackedPlaceholder(link.key)}
                      title={`Insert ${token}`}
                    >
                      <code>{token}</code>
                      <span>→ {link.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {!!message.trim() && normalizedTrackedLinks.length > 0 && (
              <div className={styles.messagePreviewBox}>
                <div className={styles.messagePreviewTitle}>
                  Message preview
                </div>
                <div className={styles.messagePreviewText}>
                  {previewMessageWithTrackedLinks}
                </div>
              </div>
            )}

            <div className={styles.messageToolsRow}>
              <button
                type="button"
                onClick={() => toggleToolPanel("schedule")}
                className={`${styles.secondaryActionBtn} ${
                  activeToolPanel === "schedule" ? styles.modeBtnActive : ""
                }`}
              >
                <span className={styles.secondaryActionContent}>
                  <CalendarDays size={16} />
                  <span>Schedule</span>
                </span>
                <span className={styles.secondaryActionBadge}>
                  {scheduleButtonLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleToolPanel("attachments")}
                className={`${styles.secondaryActionBtn} ${
                  activeToolPanel === "attachments" ? styles.modeBtnActive : ""
                }`}
              >
                <span className={styles.secondaryActionContent}>
                  <Paperclip size={16} />
                  <span>Attachments</span>
                </span>
                {attachmentsCount > 0 && (
                  <span className={styles.secondaryActionBadge}>
                    {attachmentsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => toggleToolPanel("links")}
                className={`${styles.secondaryActionBtn} ${
                  activeToolPanel === "links" ? styles.modeBtnActive : ""
                }`}
              >
                <span className={styles.secondaryActionContent}>
                  <Link2 size={16} />
                  <span>Links</span>
                </span>
                {trackedLinksCount > 0 && (
                  <span className={styles.secondaryActionBadge}>
                    {trackedLinksCount}
                  </span>
                )}
              </button>

              {channel === "whatsapp" && (
                <button
                  type="button"
                  onClick={() => toggleToolPanel("template")}
                  className={`${styles.secondaryActionBtn} ${
                    activeToolPanel === "template" ? styles.modeBtnActive : ""
                  }`}
                >
                  <span className={styles.secondaryActionContent}>
                    <MessageSquareText size={16} />
                    <span>Template</span>
                  </span>
                  <span className={styles.secondaryActionBadge}>
                    {templateButtonLabel}
                  </span>
                </button>
              )}
            </div>

            {activeToolPanel && (
              <div className={styles.inlineToolPanel}>
                {activeToolPanel === "schedule" && (
                  <div className={styles.toolPanelCard}>
                    <div className={styles.panelTitle}>
                      {translation("Broadcast.schedule")}
                    </div>

                    <div className={styles.scheduleModeRow}>
                      <button
                        type="button"
                        className={`${styles.kbdBtn} ${
                          deliveryMode === "now" ? styles.modeBtnActive : ""
                        }`}
                        onClick={() => setDeliveryMode("now")}
                      >
                        {translation("Broadcast.sendnow")}
                      </button>

                      <button
                        type="button"
                        className={`${styles.kbdBtn} ${
                          deliveryMode === "schedule"
                            ? styles.modeBtnActive
                            : ""
                        }`}
                        onClick={() => setDeliveryMode("schedule")}
                      >
                        {translation("Broadcast.scheduleBtn")}
                      </button>
                    </div>

                    <div className={styles.scheduleHint}>
                      {translation("Broadcast.timezone")}: {browserTimeZone}
                    </div>

                    <div className={styles.scheduleLayout}>
                      <div className={styles.scheduleCalendarCol}>
                        <div className={styles.calendarWrap}>
                          <DatePicker
                            selected={scheduledFor}
                            onChange={(date) => {
                              if (!date) return;

                              const next = new Date(date);
                              next.setHours(
                                scheduledFor.getHours(),
                                scheduledFor.getMinutes(),
                                0,
                                0,
                              );
                              setScheduledFor(next);
                            }}
                            inline
                            dateFormat="dd/MM/yyyy"
                            minDate={new Date()}
                          />
                        </div>
                      </div>

                      <div className={styles.scheduleTimeCol}>
                        <div className={styles.scheduleTimeCard}>
                          <div className={styles.scheduleSummaryLabel}>
                            Selected send time
                          </div>

                          <div className={styles.scheduleSummaryValue}>
                            {scheduledFor.toLocaleDateString()} ·{" "}
                            {formatHour(scheduledFor)}:
                            {formatMinute(scheduledFor)}
                          </div>

                          <div className={styles.scheduleMiniHint}>
                            Choose a time between 08:00 and 20:00.
                          </div>

                          <div className={styles.timeInputGroup}>
                            <label className={styles.smallLabel}>
                              {translation("Broadcast.hour")}
                            </label>

                            <div
                              className={styles.timeInputsCompact}
                              onBlur={(e) => {
                                if (e.currentTarget.contains(e.relatedTarget)) {
                                  return;
                                }

                                const ok = commitTimeParts(
                                  hourDraft,
                                  minuteDraft,
                                );
                                if (!ok) {
                                  setHourDraft(formatHour(scheduledFor));
                                  setMinuteDraft(formatMinute(scheduledFor));
                                }
                              }}
                            >
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="08"
                                value={hourDraft}
                                onChange={(e) =>
                                  handleHourChange(e.target.value)
                                }
                                className={styles.timeInputSmall}
                              />

                              <span className={styles.timeSeparator}>:</span>

                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="00"
                                value={minuteDraft}
                                onChange={(e) =>
                                  handleMinuteChange(e.target.value)
                                }
                                className={styles.timeInputSmall}
                              />
                            </div>

                            {timeError && (
                              <div className={styles.scheduleError}>
                                {timeError}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {deliveryMode === "schedule" &&
                      scheduleInvalid &&
                      !timeError && (
                        <div className={styles.scheduleError}>
                          {translation("Broadcast.scheduleError")}
                        </div>
                      )}
                  </div>
                )}

                {activeToolPanel === "attachments" && (
                  <div className={styles.toolPanelCard}>
                    <div className={styles.panelTitle}>
                      Anexos ({channel === "whatsapp" ? "WhatsApp" : "Teams"})
                    </div>

                    <div className={styles.imagesRow}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="*/*"
                        multiple
                        onChange={handlePickFiles}
                      />
                    </div>

                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handlePickThumbnail}
                    />

                    <div className={styles.filesStack}>
                      {imageFiles.length > 0 && (
                        <div>
                          <div className={styles.label}>Imagens</div>

                          <div className={styles.thumbStrip}>
                            {imageFiles.map((f) => (
                              <div key={f.url} className={styles.thumbWrap}>
                                <img
                                  src={f.url}
                                  alt={f.name || "upload"}
                                  width={110}
                                  height={110}
                                  className={styles.imageThumb}
                                />

                                <button
                                  onClick={() => removeFile(f.url)}
                                  className={styles.thumbClose}
                                  type="button"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {videoFiles.length > 0 && (
                        <div>
                          <div className={styles.label}>Vídeos</div>

                          <div className={styles.fileList}>
                            {videoFiles.map((f) => (
                              <div key={f.url} className={styles.fileItem}>
                                <div className={styles.fileMeta}>
                                  <div className={styles.fileName}>
                                    {f.name || "video"}
                                  </div>
                                  <div className={styles.fileType}>
                                    {f.contentType}
                                  </div>
                                </div>

                                <div className={styles.fileActions}>
                                  <button
                                    type="button"
                                    onClick={() => openThumbnailPicker(f.url)}
                                    className={styles.kbdBtn}
                                  >
                                    Thumbnail
                                  </button>

                                  {f.thumbnailUrl && (
                                    <button
                                      type="button"
                                      onClick={() => removeThumbnail(f.url)}
                                      className={styles.kbdBtn}
                                    >
                                      Remove thumb
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => removeFile(f.url)}
                                    className={styles.kbdBtn}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {otherFiles.length > 0 && (
                        <div>
                          <div className={styles.label}>Ficheiros</div>

                          <div className={styles.fileList}>
                            {otherFiles.map((f) => (
                              <div key={f.url} className={styles.fileItem}>
                                <div className={styles.fileMeta}>
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {f.name || "file"}
                                  </a>
                                  <div className={styles.fileType}>
                                    {f.contentType}
                                  </div>
                                </div>

                                <div className={styles.fileActions}>
                                  <button
                                    type="button"
                                    onClick={() => removeFile(f.url)}
                                    className={styles.kbdBtn}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {files.length === 0 && (
                        <div className={styles.emptyMini}>
                          Sem anexos adicionados.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeToolPanel === "links" && (
                  <div className={styles.toolPanelCard}>
                    <div className={styles.modalSectionHeader}>
                      <div className={styles.panelTitle}>Tracked Links</div>

                      <button
                        type="button"
                        onClick={addTrackedLink}
                        className={styles.kbdBtn}
                      >
                        <Plus size={14} />
                        <span>Add link</span>
                      </button>
                    </div>

                    <div className={styles.modalHelpText}>
                      Add placeholders like <code>{`{{link.training}}`}</code>{" "}
                      inside the message.
                    </div>

                    <div className={styles.trackedLinksGrid}>
                      {trackedLinks.map((link, index) => (
                        <div key={link.id} className={styles.trackedLinkCard}>
                          <div className={styles.trackedLinkCardHeader}>
                            <strong>Link {index + 1}</strong>

                            <button
                              type="button"
                              onClick={() => removeTrackedLink(link.id)}
                              className={styles.kbdBtn}
                            >
                              <Trash2 size={14} />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className={styles.fieldWide}>
                            <label className={styles.smallLabel}>Key</label>
                            <input
                              value={link.key}
                              onChange={(e) =>
                                updateTrackedLink(
                                  link.id,
                                  "key",
                                  e.target.value,
                                )
                              }
                              placeholder="training"
                              className={styles.input}
                            />
                          </div>

                          <div className={styles.fieldWide}>
                            <label className={styles.smallLabel}>Label</label>
                            <input
                              value={link.label}
                              onChange={(e) =>
                                updateTrackedLink(
                                  link.id,
                                  "label",
                                  e.target.value,
                                )
                              }
                              placeholder="Aceder à formação"
                              className={styles.input}
                            />
                          </div>

                          <div className={styles.fieldWide}>
                            <label className={styles.smallLabel}>
                              Destination URL
                            </label>
                            <input
                              value={link.destinationUrl}
                              onChange={(e) =>
                                updateTrackedLink(
                                  link.id,
                                  "destinationUrl",
                                  e.target.value,
                                )
                              }
                              placeholder="https://example.com/course/123"
                              className={styles.input}
                            />
                          </div>

                          {sanitizeTrackedKey(link.key) && (
                            <div className={styles.trackedPlaceholder}>
                              Placeholder:{" "}
                              <code>{`{{link.${sanitizeTrackedKey(link.key)}}}`}</code>
                            </div>
                          )}
                        </div>
                      ))}

                      {trackedLinks.length === 0 && (
                        <div className={styles.emptyMini}>
                          No tracked links added yet.
                        </div>
                      )}

                      {!trackedLinksValid && trackedLinks.length > 0 && (
                        <div className={styles.helpDanger}>
                          Complete every tracked link and avoid duplicate keys.
                        </div>
                      )}
                    </div>

                    {channel === "whatsapp" && needsUrlVar && (
                      <div className={styles.modalSection}>
                        <div className={styles.panelTitle}>
                          WhatsApp CTA Button
                        </div>

                        <div className={styles.fieldWide}>
                          <label className={styles.smallLabel}>
                            Tracked link for CTA button
                          </label>

                          <select
                            value={selectedTrackedUrlKey}
                            onChange={(e) =>
                              setSelectedTrackedUrlKey(e.target.value)
                            }
                            className={styles.select}
                            disabled={trackedLinkOptions.length === 0}
                          >
                            {trackedLinkOptions.length === 0 ? (
                              <option value="">Add a tracked link first</option>
                            ) : (
                              <>
                                <option value="">Select tracked link</option>
                                {trackedLinkOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>

                          {trackedLinkOptions.length === 0 && (
                            <div className={styles.inlineHelpText}>
                              This template needs a URL variable, so you should
                              add at least one tracked link.
                            </div>
                          )}
                        </div>

                        {!whatsappUrlBindingValid && (
                          <div className={styles.helpDanger}>
                            Select which tracked link should power the WhatsApp
                            CTA button.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeToolPanel === "template" && channel === "whatsapp" && (
                  <div className={styles.toolPanelCard}>
                    <div className={styles.panelTitle}>
                      Pré-Visualização do Template
                    </div>

                    {tplErr && <div className={styles.errorBox}>{tplErr}</div>}

                    <div className={styles.templateCardBody}>
                      <div className={styles.templateFields}>
                        <div className={styles.field}>
                          <div className={styles.label}>
                            {translation("Broadcast.template")}
                          </div>

                          <select
                            disabled={tplLoading || nameOptions.length === 0}
                            value={tplName}
                            onChange={(e) => setTplName(e.target.value)}
                            className={styles.select}
                          >
                            {nameOptions.length === 0 ? (
                              <option value="">
                                {translation("Broadcast.noTemplates")}
                              </option>
                            ) : (
                              nameOptions.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {varDefs.length > 0 ? (
                          <div className={styles.gridSingle}>
                            {varDefs.map((v) => {
                              const kLower = String(v.key || "").toLowerCase();
                              const locked = isLockedVar(kLower);

                              let displayVal = varValues[v.key] ?? "";
                              if (
                                !displayVal &&
                                COMPANY_KEYS.includes(kLower)
                              ) {
                                displayVal = org?.name || "";
                              }
                              if (!displayVal && NAME_KEYS.includes(kLower)) {
                                displayVal = sampleRecipient?.name || "";
                              }

                              const placeholder =
                                v.examplesLocale?.[tplLang]
                                  ?.exampleValueStrings?.[0] ??
                                (v.examplesLocale
                                  ? v.examplesLocale[
                                      Object.keys(v.examplesLocale)[0]
                                    ]?.exampleValueStrings?.[0]
                                  : "") ??
                                "";

                              return (
                                <div key={v.key} className={styles.fieldWide}>
                                  <label className={styles.smallLabel}>
                                    {v.key}
                                    {v.characterLimit
                                      ? ` · máx ${v.characterLimit}`
                                      : ""}
                                    {v.description ? ` — ${v.description}` : ""}
                                  </label>

                                  {locked ? (
                                    <div className={styles.lockedField}>
                                      {displayVal || "—"}
                                    </div>
                                  ) : (
                                    <input
                                      value={varValues[v.key] ?? ""}
                                      onChange={(e) =>
                                        setVarValues((prev) => ({
                                          ...prev,
                                          [v.key]: e.target.value,
                                        }))
                                      }
                                      placeholder={placeholder}
                                      maxLength={v.characterLimit || undefined}
                                      className={styles.input}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.fieldWide}>
                            <label className={styles.smallLabel}>
                              {translation("Broadcast.varKeyDesc")}
                            </label>

                            <input
                              value={tplParamsManual}
                              onChange={(e) =>
                                setTplParamsManual(e.target.value)
                              }
                              placeholder="name=Gaspar,url=?session=123"
                              className={styles.input}
                            />
                          </div>
                        )}

                        {!paramsComplete && (
                          <div className={styles.helpDanger}>
                            {translation("Common.error")}
                          </div>
                        )}
                      </div>

                      <aside className={styles.templatePreviewCol}>
                        {preview.body ||
                        preview.buttonText ||
                        preview.buttonUrl ? (
                          <>
                            <div
                              className={`${styles.waFrame} ${styles.waFrameSmall}`}
                            >
                              <div className={styles.waHeader}>
                                <div className={styles.waAvatar}>U</div>

                                <div className={styles.waHeaderText}>
                                  <div className={styles.waTitle}>
                                    {sampleRecipient?.name ||
                                      translation("Common.none")}
                                  </div>
                                  <div className={styles.waSubtitle}>
                                    online
                                  </div>
                                </div>

                                <div className={styles.waIcons}>⋯</div>
                              </div>

                              <div className={styles.waChat}>
                                <div className={styles.waRowOut}>
                                  <div className={styles.waBubbleOut}>
                                    <span className={styles.waText}>
                                      {preview.body || "—"}
                                    </span>
                                    <span className={styles.waMeta}>
                                      {previewTime} ✓✓
                                    </span>
                                  </div>
                                </div>

                                {(preview.buttonText || preview.buttonUrl) && (
                                  <div className={styles.waRowOut}>
                                    <button
                                      className={styles.waCtaBtn}
                                      type="button"
                                    >
                                      {preview.buttonText || "Abrir"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {preview.buttonUrl && (
                              <div className={styles.previewUrlHint}>
                                URL: {preview.buttonUrl}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={styles.previewPlaceholder}>
                            {translation("Common.noResults")}
                          </div>
                        )}
                      </aside>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.panel}>
            <div className={styles.recipientsHeader}>
              <div className={styles.recipientsActionsRow}>
                <button
                  type="button"
                  ref={filterBtnRef}
                  className={`${styles.kbdBtn} ${styles.filterBtn}`}
                  onClick={() => setFilterOpen((v) => !v)}
                  title={translation("Common.filter")}
                >
                  <Filter size={16} />
                  <span>{translation("Common.filter")}</span>

                  {activeFilterCount > 0 && (
                    <span className={styles.filterBadge}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button onClick={toggleAllCurrent} className={styles.kbdBtn}>
                  {allOnPageSelected
                    ? translation("Broadcast.deselectAll")
                    : translation("Broadcast.selectAll")}
                </button>
              </div>
            </div>

            <div className={styles.searchWrap}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={translation("Broadcast.searchPeople")}
                className={styles.searchInput}
              />
            </div>

            {activeFilterCount > 0 && (
              <div className={styles.activeFilters}>
                {selectedTagIds.map((id) => {
                  const t = allTags.find((x) => x.id === id);
                  if (!t) return null;

                  return (
                    <button
                      key={`t${id}`}
                      className={styles.filterChip}
                      onClick={() =>
                        setSelectedTagIds((prev) =>
                          prev.filter((x) => x !== id),
                        )
                      }
                      title={translation("Users.filters.remove")}
                    >
                      {t.name} ×
                    </button>
                  );
                })}

                {selectedAssistantIds.map((id) => {
                  const a = assistantsList.find((x) => x.id === id);
                  if (!a) return null;

                  return (
                    <button
                      key={`a${id}`}
                      className={styles.filterChip}
                      onClick={() =>
                        setSelectedAssistantIds((prev) =>
                          prev.filter((x) => x !== id),
                        )
                      }
                      title={translation("Users.filters.remove")}
                    >
                      {a.name} ×
                    </button>
                  );
                })}

                <button
                  className={styles.filterClearAll}
                  onClick={() => {
                    setSelectedTagIds([]);
                    setSelectedAssistantIds([]);
                  }}
                >
                  {translation("Common.clearAll")}
                </button>
              </div>
            )}

            <div className={styles.listBox}>
              {filtered.map((u, i) => {
                const isSel = selected.has(u.id);

                return (
                  <label
                    key={u.id}
                    className={`${styles.row} ${i % 2 ? styles.rowAlt : ""} ${
                      isSel ? styles.rowSel : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(u.id)}
                    />

                    <div className={styles.avatar}>{getInitial(u.name)}</div>

                    <div className={styles.nameBlock}>
                      <div className={styles.name}>
                        {u.name || translation("Common.none")}
                      </div>
                      <div className={styles.subline}>
                        {channel === "whatsapp" ? u.phone_number : u.email}
                      </div>
                    </div>
                  </label>
                );
              })}

              {filtered.length === 0 && (
                <div className={styles.empty}>
                  {translation("Broadcast.emptyUsers")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilterMenu
        side="left"
        open={filterOpen}
        anchorEl={filterBtnRef.current}
        tags={allTags}
        assistants={assistantsList}
        selectedTagIds={selectedTagIds}
        setSelectedTagIds={setSelectedTagIds}
        selectedAssistantIds={selectedAssistantIds}
        setSelectedAssistantIds={setSelectedAssistantIds}
        onClose={() => setFilterOpen(false)}
        onClear={() => {
          setSelectedTagIds([]);
          setSelectedAssistantIds([]);
          setFilterOpen(false);
        }}
      />
    </div>
  );
}
