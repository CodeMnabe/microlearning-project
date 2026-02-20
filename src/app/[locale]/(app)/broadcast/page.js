/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./broadcast.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useTranslations } from "next-intl";

function Initial(name = "") {
  return (name?.trim()?.[0] || "?").toUpperCase();
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

const isLockedVar = (key) => {
  const k = String(key || "").toLowerCase();
  return NAME_KEYS.includes(k) || COMPANY_KEYS.includes(k);
};

const STATUS_RANK = {
  ACTIVE: 4,
  PENDING: 3,
  PENDINGREVIEW: 3,
  DRAFT: 2,
  INACTIVE: 1,
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
    if (NAME_KEYS.includes(k))
      return values.recipientName ?? values[rawKey] ?? values[k] ?? "";
    if (COMPANY_KEYS.includes(k))
      return values.orgName ?? values[rawKey] ?? values[k] ?? "";
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
      )
        out.push(v);
      else extractText(v, out);
    }
  }
  return out;
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

export default function BroadcastPage() {
  const { user } = useAuth();
  const { org } = useOrganization(user);
  const translation = useTranslations();
  const supabase = createClient();
  const { startLoading, stopLoading } = useGlobalLoader();

  // people
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());

  // pickers
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const [thumbForVideoUrl, setThumbForVideoUrl] = useState(null);

  // message & files
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]); // [{ url, name, contentType, thumbnailUrl? }]

  // sending
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // templates (list)
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState(null);

  const [tplName, setTplName] = useState("");
  const [tplLang, setTplLang] = useState("pt-PT");

  // template details / variables
  const [tplDetails, setTplDetails] = useState(null);
  const [varDefs, setVarDefs] = useState([]);
  const [varValues, setVarValues] = useState({});
  const [needsUrlVar, setNeedsUrlVar] = useState(false);
  const [tplUrlVar, setTplUrlVar] = useState("");
  const [tplParamsManual, setTplParamsManual] = useState("");

  // channel switch
  const [channel, setChannel] = useState("teams");

  // derived lists for UI
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

  const getUsers = useCallback(async () => {
    if (!org?.id) return;
    const res = await fetch(`/api/users?orgId=${org.id}`);
    const data = await res.json().catch(() => []);
    setUsers(Array.isArray(data) ? data : data?.users || []);
  }, [org?.id]);

  const loadTemplates = useCallback(async () => {
    if (!org?.id) return;
    setTplLoading(true);
    setTplErr(null);
    try {
      const res = await fetch(`/api/template/list?orgId=${org.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch templates");

      const items = (data.items || []).map((t) => ({
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
  }, [org?.id, channel, getUsers, loadTemplates, startLoading, stopLoading]);

  // group & choose template
  const templatesByName = useMemo(() => {
    const m = new Map();
    for (const t of templates) {
      if (!m.has(t.name)) m.set(t.name, []);
      m.get(t.name).push(t);
    }
    for (const [k, arr] of m) m.set(k, arr.sort(byBestStatus));
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

  function blocksHaveUrlVariable(blocks) {
    const visit = (n) => {
      if (!n) return false;
      if (Array.isArray(n)) return n.some(visit);
      if (typeof n === "object") {
        for (const [k, v] of Object.entries(n)) {
          if (k === "url" && typeof v === "string" && v.includes("{{"))
            return true;
          if (visit(v)) return true;
        }
      }
      return false;
    };
    return visit(blocks);
  }

  // fetch details of selected template
  useEffect(() => {
    let alive = true;
    (async () => {
      setTplDetails(null);
      setVarDefs([]);
      setVarValues({});
      setNeedsUrlVar(false);
      setTplUrlVar("");
      if (!org?.id || !chosenTemplate || channel !== "whatsapp") return;

      try {
        const res = await fetch(
          `/api/template?orgId=${org.id}&projectId=${chosenTemplate.projectId}&id=${chosenTemplate.id}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to fetch template");
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
    return () => (alive = false);
  }, [org?.id, chosenTemplate, tplLang, channel]);

  // recipients filter
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        String(u.name || "")
          .toLowerCase()
          .includes(term) ||
        String(u.phone_number || "")
          .toLowerCase()
          .includes(term),
    );
  }, [q, users]);

  function toggleOne(id) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAllCurrent() {
    setSelected((s) => {
      const n = new Set(s);
      const ids = filtered.map((u) => u.id);
      const allSel = ids.every((id) => n.has(id));
      (allSel ? ids : []).forEach((id) => n.delete(id));
      (!allSel ? ids : []).forEach((id) => n.add(id));
      return n;
    });
  }

  function removeFile(url) {
    setFiles((prev) => prev.filter((f) => f.url !== url));
  }

  // Upload helper
  const supabaseUpload = async (pickedFiles) => {
    const bucket = "images"; // keeping your existing bucket
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
      alert(translation("Common.error") + ": " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Thumbnail picking for a given video
  function openThumbnailPicker(videoUrl) {
    setThumbForVideoUrl(videoUrl);
    // trigger hidden picker
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
      // only first image
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
      alert(translation("Common.error") + ": " + err.message);
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

  // ordered param values
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

  const sampleRecipient = useMemo(
    () => users.find((u) => selected.has(u.id)) || null,
    [users, selected],
  );

  const previewVars = useMemo(() => {
    const map = {};
    for (const v of varDefs) map[v.key] = varValues[v.key] ?? "";
    map.recipientName = sampleRecipient?.name || map.name || map.nome || "";
    map.orgName =
      org?.name || map.empresa || map.company || map.organization || "";
    map.urlVar = tplUrlVar || "";
    return map;
  }, [varDefs, varValues, sampleRecipient, tplUrlVar, org?.name]);

  const preview = useMemo(() => {
    if (!tplDetails) return { body: "", buttonText: "", buttonUrl: "" };
    const pc =
      (tplDetails.platformContent || []).find(
        (x) => (x.locale || tplDetails.defaultLocale) === tplLang,
      ) || (tplDetails.platformContent || [])[0];

    const blocks = pc?.blocks?.length
      ? pc.blocks
      : tplDetails.genericContent?.[0]?.blocks || [];
    const bodyRaw = extractText(blocks).join("\n\n");
    const body = interpolate(bodyRaw, previewVars);

    let buttonText = "",
      buttonUrl = "";
    (function scan(n) {
      if (!n) return;
      if (Array.isArray(n)) return n.forEach(scan);
      if (typeof n === "object") {
        if (n.action?.type === "link" && n.action.link) {
          buttonText = n.action.link.text || buttonText;
          buttonUrl = n.action.link.url || buttonUrl;
        }
        for (const v of Object.values(n)) scan(v);
      }
    })(blocks);

    buttonText = interpolate(buttonText, previewVars);
    buttonUrl = interpolate(buttonUrl, {
      ...previewVars,
      urlVar: previewVars.urlVar,
    });
    return { body, buttonText, buttonUrl };
  }, [tplDetails, tplLang, previewVars]);

  const paramsComplete =
    (varDefs.length === 0 && tplParamsManual.trim().length > 0) ||
    (varDefs.length > 0 && orderedParamValues.every((v) => v !== ""));

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

  const canSend =
    selected.size > 0 &&
    (channel === "whatsapp"
      ? (tplName && tplLang && paramsComplete) ||
        message.trim().length > 0 ||
        files.length > 0
      : message.trim().length > 0 || files.length > 0);

  async function handleSend() {
    const chosen = users.filter((u) => selected.has(u.id));
    if (!chosen.length) return alert(translation("Broadcast.chooseRecipients"));

    setSending(true);
    setResult(null);

    try {
      if (channel === "whatsapp") {
        // Backwards compatible: send imageUrls (old) + files (new)
        const payload = {
          orgId: org?.id,
          message,
          imageUrls, // ✅ for your existing WhatsApp route
          files, // ✅ for future route upgrades
          recipients: chosen.map((u) => u.phone_number),
          template:
            tplName && tplLang && paramsComplete
              ? {
                  projectId: chosenTemplate?.projectId,
                  name: tplName.trim(),
                  languageCode: (tplLang || "pt-PT").trim(),
                  params: orderedParamValues,
                  varKeys: varDefs.length ? varDefs.map((v) => v.key) : [],
                  manualParams: varDefs.length ? undefined : tplParamsManual,
                  urlVar: needsUrlVar ? tplUrlVar.trim() || null : null,
                }
              : null,
        };

        const res = await fetch("/api/broadcast/whatsapp", {
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

        setResult(data);

        if (!res.ok) {
          console.error("Broadcast error", data);
          alert(translation("Common.error"));
        }
      } else {
        // TEAMS
        const payload = {
          orgId: org?.id,
          userIds: chosen.map((u) => u.id),
          message,
          files, // ✅ includes thumbnailUrl for videos
        };

        const res = await fetch("/api/broadcast/teams", {
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

        setResult(data);

        if (!res.ok) {
          console.error("Teams broadcast error", data);
          alert(translation("Common.error"));
        }
      }
    } catch (err) {
      console.error("[Broadcast] handleSend error", err);
      alert(translation("Common.error") + ": " + err.message);
    } finally {
      setSending(false);
    }
  }

  const allOnPageSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  return (
    <div className={styles.screen}>
      <div className={styles.headerRow}>
        <div className={styles.channelSwitch}>
          <button
            type="button"
            className={`${styles.channelBtn} ${channel === "teams" ? styles.channelBtnActive : ""}`}
            onClick={() => setChannel("teams")}
          >
            Teams
          </button>
          <button
            type="button"
            className={`${styles.channelBtn} ${channel === "whatsapp" ? styles.channelBtnActive : ""}`}
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
            onClick={handleSend}
            disabled={sending || !canSend}
            className={styles.primaryBtn}
          >
            {sending
              ? translation("Broadcast.sending")
              : translation("Broadcast.send")}
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        {/* LEFT */}
        <div className={styles.leftCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>
              {translation("Broadcast.message")}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              placeholder={translation("Broadcast.messagePlaceholder")}
              className={styles.textarea}
            />

            {/* FILE picker */}
            <div className={styles.imagesRow}>
              <label className={styles.label}>
                Anexos ({channel === "whatsapp" ? "WhatsApp" : "Teams"})
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                multiple
                onChange={handlePickFiles}
              />
            </div>

            {/* hidden thumbnail picker (used per-video) */}
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePickThumbnail}
            />

            {/* Images */}
            {imageFiles.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className={styles.label}>Imagens</div>
                <div className={styles.thumbStrip}>
                  {imageFiles.map((f) => (
                    <div key={f.url} className={styles.thumbWrap}>
                      <img
                        src={f.url}
                        alt={f.name || "upload"}
                        width={120}
                        height={120}
                        style={{
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #eee",
                        }}
                      />
                      <button
                        onClick={() => removeFile(f.url)}
                        className={styles.thumbClose}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videoFiles.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className={styles.label}>Vídeos (Teams: card + botão)</div>
                {videoFiles.map((f) => (
                  <div
                    key={f.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 0",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    {/* thumb preview */}
                    <div
                      style={{
                        width: 72,
                        height: 44,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #eee",
                        background: "#fafafa",
                      }}
                    >
                      {f.thumbnailUrl ? (
                        <img
                          src={f.thumbnailUrl}
                          alt="thumb"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            opacity: 0.7,
                          }}
                        >
                          sem thumb
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{f.name || "video"}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {f.contentType}
                      </div>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12 }}
                      >
                        abrir link
                      </a>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openThumbnailPicker(f.url)}
                        className={styles.kbdBtn}
                      >
                        Adicionar thumbnail
                      </button>
                      {f.thumbnailUrl && (
                        <button
                          type="button"
                          onClick={() => removeThumbnail(f.url)}
                          className={styles.kbdBtn}
                        >
                          Remover thumb
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(f.url)}
                        className={styles.kbdBtn}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other files */}
            {otherFiles.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className={styles.label}>Ficheiros</div>
                {otherFiles.map((f) => (
                  <div
                    key={f.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.name || "file"}
                    </a>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      {f.contentType}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.url)}
                      className={styles.kbdBtn}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template section (kept as-is in your version) */}
          {channel === "whatsapp" && (
            <div className={`${styles.panel} ${styles.panelSlim}`}>
              <div className={styles.panelTitle}>
                {translation("Broadcast.templatePreview")}
              </div>
              {tplErr && <div className={styles.errorBox}>{tplErr}</div>}

              <div className={styles.templateGrid}>
                <div className={styles.templateFormCol}>
                  <div className={styles.templateRow}>
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

                    {chosenTemplate && (
                      <div className={styles.meta}>
                        <span className={styles.metaItem}>
                          <span className={`${styles.pill} ${styles.pillSoft}`}>
                            {/* status */}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {varDefs.length > 0 ? (
                    <div className={styles.grid}>
                      {varDefs.map((v) => {
                        const kLower = String(v.key || "").toLowerCase();
                        const locked = isLockedVar(kLower);

                        let displayVal = varValues[v.key] ?? "";
                        if (!displayVal && COMPANY_KEYS.includes(kLower))
                          displayVal = org?.name || "";
                        if (!displayVal && NAME_KEYS.includes(kLower))
                          displayVal = sampleRecipient?.name || "";

                        const placeholder =
                          v.examplesLocale?.[tplLang]
                            ?.exampleValueStrings?.[0] ??
                          (v.examplesLocale
                            ? v.examplesLocale[Object.keys(v.examplesLocale)[0]]
                                ?.exampleValueStrings?.[0]
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
                              {locked && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 11,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                    background: "#F3F4F6",
                                    color: "#374151",
                                  }}
                                >
                                  auto
                                </span>
                              )}
                            </label>

                            {locked ? (
                              <div
                                style={{
                                  padding: "10px 12px",
                                  border: "1px dashed #e5e7eb",
                                  borderRadius: 10,
                                  background: "#F9FAFB",
                                  color: "#111827",
                                  minHeight: 40,
                                  display: "flex",
                                  alignItems: "center",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
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
                      {!paramsComplete && (
                        <div className={styles.helpDanger}>
                          {translation("Common.error")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.fieldWide}>
                      <label className={styles.smallLabel}>
                        {translation("Broadcast.varKeyDesc")}
                      </label>
                      <input
                        value={tplParamsManual}
                        onChange={(e) => setTplParamsManual(e.target.value)}
                        placeholder="name=Gaspar,url=?session=123"
                        className={styles.input}
                      />
                    </div>
                  )}

                  {needsUrlVar && (
                    <div className={styles.fieldWide}>
                      <label className={styles.smallLabel}>
                        {translation("Broadcast.urlVar")}
                      </label>
                      <input
                        value={tplUrlVar}
                        onChange={(e) => setTplUrlVar(e.target.value)}
                        placeholder="session-12345"
                        className={styles.input}
                      />
                    </div>
                  )}
                </div>

                <aside className={styles.previewCol}>
                  {preview.body || preview.buttonText || preview.buttonUrl ? (
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
                            <div className={styles.waSubtitle}>online</div>
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
                                {new Date().toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                ✓✓
                              </span>
                            </div>
                          </div>
                          {(preview.buttonText || preview.buttonUrl) && (
                            <div className={styles.waRowOut}>
                              <button className={styles.waCtaBtn} type="button">
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

        {/* RIGHT */}
        <div className={styles.rightCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitleRow}>
              <div className={styles.panelTitle}>
                {translation("Broadcast.recipients")}
              </div>
              <button onClick={toggleAllCurrent} className={styles.kbdBtn}>
                {allOnPageSelected
                  ? translation("Broadcast.deselectAll")
                  : translation("Broadcast.selectAll")}
              </button>
            </div>

            <div className={styles.searchWrap}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={translation("Broadcast.searchPeople")}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.listBox}>
              {filtered.map((u, i) => {
                const isSel = selected.has(u.id);
                return (
                  <label
                    key={u.id}
                    className={`${styles.row} ${i % 2 ? styles.rowAlt : ""} ${isSel ? styles.rowSel : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(u.id)}
                    />
                    <div className={styles.avatar}>{Initial(u.name)}</div>
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
    </div>
  );
}
