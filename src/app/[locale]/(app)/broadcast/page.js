"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./broadcast.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import Image from "next/image";
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
  const fileInputRef = useRef(null);

  // message & images
  const [message, setMessage] = useState("");
  const [imageUrls, setImageUrls] = useState([]);

  // sending
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // templates (list)
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState(null);

  const [tplName, setTplName] = useState("");
  const [tplLang, setTplLang] = useState("pt-PT"); // ← fixed language (hidden in UI)

  // template details / variables
  const [tplDetails, setTplDetails] = useState(null);
  const [varDefs, setVarDefs] = useState([]);
  const [varValues, setVarValues] = useState({});
  const [needsUrlVar, setNeedsUrlVar] = useState(false);
  const [tplUrlVar, setTplUrlVar] = useState("");
  const [tplParamsManual, setTplParamsManual] = useState("");

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

      // preselect best and lock to pt-PT if available
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
      await loadTemplates();
      if (alive) stopLoading();
    })();
    return () => {
      alive = false;
    };
  }, [org?.id, getUsers, loadTemplates, startLoading, stopLoading]);

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
    [templatesByName]
  );

  const languagesForChosenName = useMemo(
    () => (tplName ? templatesByName.get(tplName) || [] : []),
    [tplName, templatesByName]
  );

  // on name change, lock language to pt-PT when present, else best available
  useEffect(() => {
    if (!tplName) return;
    const list = templatesByName.get(tplName) || [];
    const pt = list.find((t) =>
      (t.language || "").toLowerCase().startsWith("pt")
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
      if (!org?.id || !chosenTemplate) return;
      try {
        const res = await fetch(
          `/api/template?orgId=${org.id}&projectId=${chosenTemplate.projectId}&id=${chosenTemplate.id}`
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
            (pc) => (pc.locale || data.defaultLocale) === tplLang
          ) || (data.platformContent || [])[0];

        setNeedsUrlVar(blocksHaveUrlVariable(blocksForLocale?.blocks || []));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => (alive = false);
  }, [org?.id, chosenTemplate, tplLang]);

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
          .includes(term)
    );
  }, [q, users]);

  function removeImage(url) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }
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

  const supabaseUpload = async (files) => {
    const bucket = "whatsapp-broadcasts";
    const newUrls = [];
    for (const file of files) {
      const key = `broadcasts/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(key, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }
    return newUrls;
  };
  async function handlePickFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const urls = await supabaseUpload(files);
      setImageUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      alert(translation("Common.error") + ": " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          })
      );
      return Array.from(map.values());
    }
    return varDefs.map((v) => (varValues[v.key] ?? "").trim());
  }, [varDefs, varValues, tplParamsManual]);

  const sampleRecipient = useMemo(
    () => users.find((u) => selected.has(u.id)) || null,
    [users, selected]
  );

  const previewVars = useMemo(() => {
    const map = {};
    for (const v of varDefs) map[v.key] = varValues[v.key] ?? "";

    map.recipientName = sampleRecipient?.name || map.name || map.nome || "";

    // NEW: org name used by company/empresa/organization placeholders
    map.orgName =
      org?.name || map.empresa || map.company || map.organization || "";

    map.urlVar = tplUrlVar || "";
    return map;
  }, [varDefs, varValues, sampleRecipient, tplUrlVar, org?.name]);

  const preview = useMemo(() => {
    if (!tplDetails) return { body: "", buttonText: "", buttonUrl: "" };
    const pc =
      (tplDetails.platformContent || []).find(
        (x) => (x.locale || tplDetails.defaultLocale) === tplLang
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
    ((tplName && tplLang && paramsComplete) ||
      message.trim().length > 0 ||
      imageUrls.length > 0);

  async function handleSend() {
    const chosen = users.filter((u) => selected.has(u.id));
    if (!chosen.length) return alert(translation("Broadcast.chooseRecipients"));
    setSending(true);
    setResult(null);
    try {
      const payload = {
        orgId: org?.id,
        message,
        imageUrls,
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
      const data = await res.json();
      setResult(data);
      if (!res.ok) {
        console.error("Broadcast error", data);
        alert(translation("Common.error"));
      }
    } catch (err) {
      console.error(err);
      alert(translation("Common.error") + ": " + err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleSendTemplateOnly() {
    const chosen = users.filter((u) => selected.has(u.id));
    if (!chosen.length) return alert(translation("Broadcast.chooseRecipients"));
    if (!tplName.trim() || !paramsComplete)
      return alert(translation("Common.error"));
    setSending(true);
    setResult(null);
    try {
      const nameIdx = varDefs.findIndex(
        (v) =>
          (v.key || "").toLowerCase() === "name" ||
          (v.key || "").toLowerCase() === "nome"
      );
      const results = await Promise.all(
        chosen.map(async (u) => {
          const kvParams =
            varDefs.length > 0
              ? varDefs.map((v, idx) => {
                  const baseVal = orderedParamValues[idx] ?? "";
                  const val = idx === nameIdx ? (u.name || "").trim() : baseVal;
                  return `${v.key}=${val}`;
                })
              : tplParamsManual
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);

          const res = await fetch("/api/whatsapp/send-template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orgId: org.id,
              to: u.phone_number,
              projectId: chosenTemplate?.projectId,
              templateName: tplName.trim(),
              languageCode: (tplLang || "pt-PT").trim(),
              params: kvParams,
              urlVar: needsUrlVar ? tplUrlVar.trim() || undefined : undefined,
            }),
          });
          const data = await res.json().catch(() => ({}));
          return { to: u.phone_number, ok: res.ok, status: res.status, data };
        })
      );
      setResult({
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
        note: "send-template results",
      });
    } catch (err) {
      console.error(err);
      alert(translation("Common.error") + ": " + err.message);
    } finally {
      setSending(false);
    }
  }

  const allOnPageSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  // softer status pill
  const StatusPill = ({ s }) => (
    <span className={`${styles.pill} ${styles.pillSoft}`}>{s}</span>
  );

  return (
    <div className={styles.screen}>
      <div className={styles.headerRow}>
        <h1>{translation("Broadcast.title")}</h1>
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
          {/* <button
            onClick={handleSendTemplateOnly}
            disabled={
              sending ||
              selected.size === 0 ||
              !tplName.trim() ||
              !paramsComplete
            }
            className={styles.ghostBtn}
          >
            {sending ? translation("Broadcast.sending") : "Enviar só template"}
          </button> */}
        </div>
      </div>

      <div className={styles.columns}>
        {/* LEFT: Message + Template */}
        <div className={styles.leftCol}>
          {/* Message */}
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
            {/* <div className={styles.imagesRow}>
              <label className={styles.label}>Imagens</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePickFiles}
              />
            </div> */}
            {imageUrls.length > 0 && (
              <div className={styles.thumbStrip}>
                {imageUrls.map((u) => (
                  <div key={u} className={styles.thumbWrap}>
                    <Image
                      src={u}
                      alt="upload"
                      width={120}
                      height={120}
                      style={{
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #eee",
                      }}
                    />
                    <button
                      onClick={() => removeImage(u)}
                      className={styles.thumbClose}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template — compact */}
          <div className={`${styles.panel} ${styles.panelSlim}`}>
            <div className={styles.panelTitle}>
              {translation("Broadcast.templatePreview")}
            </div>
            {tplErr && <div className={styles.errorBox}>{tplErr}</div>}

            {/* 2-column layout: LEFT = select + fields, RIGHT = preview */}
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
                          {/* {chosenTemplate.status} */}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Variable fields */}
                {varDefs.length > 0 ? (
                  <div className={styles.grid}>
                    {varDefs.map((v) => {
                      const placeholder =
                        v.examplesLocale?.[tplLang]?.exampleValueStrings?.[0] ??
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
                          </label>
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

              {/* RIGHT: preview */}
              <aside className={styles.previewCol}>
                {preview.body || preview.buttonText || preview.buttonUrl ? (
                  <>
                    <div className={`${styles.waFrame} ${styles.waFrameSmall}`}>
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
        </div>

        {/* RIGHT: Recipients */}
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
                    className={`${styles.row} ${i % 2 ? styles.rowAlt : ""} ${
                      isSel ? styles.rowSel : ""
                    }`}
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
                      <div className={styles.subline}>{u.phone_number}</div>
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

      {/* {result && (
        <div className={styles.resultWrap}>
          <div className={styles.resultSummary}>
            <strong>{translation("Broadcast.result")}</strong> {result.ok}{" "}
            {translation("Broadcast.sent")}, {result.failed}{" "}
            {translation("Broadcast.failed")}
          </div>
          <div className={styles.resultBox}>
            {Array.isArray(result.results) &&
              result.results.map((r, idx) => (
                <div key={idx} className={styles.resultRow}>
                  <div>{String(r.to || "")}</div>
                  <div className={r.ok ? styles.ok : styles.bad}>
                    {r.ok
                      ? translation("Common.ok")
                      : translation("Common.error")}
                  </div>
                  <pre className={styles.resultPre}>
                    {JSON.stringify(r.data, null, 2)}
                  </pre>
                </div>
              ))}
          </div>
          <div className={styles.resultNote}>{result.note}</div>
        </div>
      )} */}
    </div>
  );
}
