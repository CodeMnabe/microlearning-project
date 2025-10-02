"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./broadcast.module.css";
import { useAuth } from "../AuthContext";
import useOrganization from "../hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";
import Image from "next/image";

function Initial(name = "") {
  return (name?.trim()?.[0] || "?").toUpperCase();
}

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
    if (k === "name" || k === "nome") return values.recipientName ?? "";
    // try exact + lower keys
    return values[rawKey] ?? values[k] ?? "";
  });
}

// collect human-readable text from arbitrary Bird blocks
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
  const [tplLang, setTplLang] = useState("pt");

  // template details (for dynamic fields)
  const [tplDetails, setTplDetails] = useState(null); // { variables, platformContent, defaultLocale }
  const [varDefs, setVarDefs] = useState([]); // [{ key, description, characterLimit, examplesLocale, ...}]
  const [varValues, setVarValues] = useState({}); // { key: value }
  const [needsUrlVar, setNeedsUrlVar] = useState(false);
  const [tplUrlVar, setTplUrlVar] = useState("");
  const [tplParamsManual, setTplParamsManual] = useState(""); // fallback if no variables found

  const getUsers = useCallback(async () => {
    const res = await fetch(`/api/users?orgId=${org.id}`);
    const data = await res.json().catch(() => []);
    setUsers(Array.isArray(data) ? data : data?.users || []);
  }, [org?.id]);

  const loadTemplates = useCallback(async () => {
    let alive = true;
    if (!org?.id) return;
    setTplLoading(true);
    setTplErr(null);
    try {
      const res = await fetch(`/api/template/list?orgId=${org.id}`);
      const data = await res.json();
      if (!alive) return;
      if (!res.ok) throw new Error(data?.error || "Failed to fetch templates");

      const items = (data.items || []).map((t) => ({
        ...t,
        createdAt: t.createdAt || null,
        updatedAt: t.updatedAt || null,
      }));
      setTemplates(items);

      // preselect best
      const best = [...items].sort(byBestStatus)[0];
      if (best) {
        setTplName(best.name);
        setTplLang(best.language || "pt");
      }
    } catch (e) {
      setTplErr(e.message);
    } finally {
      setTplLoading(false);
      stopLoading();
    }

    return () => (alive = false);
  }, [org?.id, stopLoading]);

  // Load template list
  useEffect(() => {
    if (!org?.id) return;
    let alive = true;
    (async () => {
      startLoading();
      await getUsers();
      await loadTemplates();
      if (alive) stopLoading();
    })();
    return () => {
      alive = false;
    };
  }, [org?.id, getUsers, loadTemplates, startLoading, stopLoading]);

  // group templates by name
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

  // when name changes, adopt best language for that name
  useEffect(() => {
    if (!tplName) return;
    const list = templatesByName.get(tplName) || [];
    if (list.length) setTplLang(list[0].language || "pt");
  }, [tplName, templatesByName]);

  const chosenTemplate = useMemo(
    () => languagesForChosenName.find((t) => t.language === tplLang) || null,
    [languagesForChosenName, tplLang]
  );

  // detect urls with {{ }} in nested structure
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

  // fetch details for selected template (variables + url-var detection)
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
        if (!alive) return;
        if (!res.ok) throw new Error(data?.error || "Failed to fetch template");

        setTplDetails(data);

        const defs = Array.isArray(data.variables) ? data.variables : [];
        const defaults = {};
        for (const v of defs) {
          const examples = v.examplesLocale?.[tplLang]?.exampleValueStrings;
          defaults[v.key] = examples?.[0] ?? "";
        }
        setVarDefs(defs);
        setVarValues(defaults);

        // url var?
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
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }
  function toggleAllCurrent() {
    const s = new Set(selected);
    const ids = filtered.map((u) => u.id);
    const allSelected = ids.every((id) => s.has(id));
    (allSelected ? ids : []).forEach((id) => s.delete(id));
    (!allSelected ? ids : []).forEach((id) => s.add(id));
    setSelected(s);
  }

  async function uploadFiles(files) {
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
  }
  async function handlePickFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const urls = await uploadFiles(files);
      setImageUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      alert("upload failed: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ordered param values for sending
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

  // build a lookup of current variable values the preview will use
  const previewVars = useMemo(() => {
    const map = {};
    for (const v of varDefs) map[v.key] = varValues[v.key] ?? "";
    // special helper values:
    map.recipientName = sampleRecipient?.name || map.name || map.nome || "";
    map.urlVar = tplUrlVar || "";
    return map;
  }, [varDefs, varValues, sampleRecipient, tplUrlVar]);

  // compute preview text + first button text/url for current locale
  const preview = useMemo(() => {
    if (!tplDetails) return { body: "", buttonText: "", buttonUrl: "" };

    // choose platform content for the current locale, else fallback
    const pc =
      (tplDetails.platformContent || []).find(
        (x) => (x.locale || tplDetails.defaultLocale) === tplLang
      ) || (tplDetails.platformContent || [])[0];

    // fallback to generic
    const blocks = pc?.blocks?.length
      ? pc.blocks
      : tplDetails.genericContent?.[0]?.blocks || [];

    // collect plain text and join
    const bodyRaw = extractText(blocks).join("\n\n");
    const body = interpolate(bodyRaw, previewVars);

    // try to find first link button
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

  // --- Auto-fill "name" param from recipients (first selected) ---
  useEffect(() => {
    if (varDefs.length === 0) return;
    const nameField = varDefs.find(
      (v) => v.key?.toLowerCase() === "name" || v.key?.toLowerCase() === "nome"
    );
    if (!nameField) return;
    const [firstSel] = users.filter((u) => selected.has(u.id));
    if (!firstSel) return;
    // Only set if empty so user can override
    setVarValues((prev) =>
      prev[nameField.key]
        ? prev
        : { ...prev, [nameField.key]: firstSel.name || "" }
    );
  }, [selected, users, varDefs]);

  const canSend =
    selected.size > 0 &&
    // You can send just template
    ((tplName && tplLang && paramsComplete) ||
      // or message/images
      message.trim().length > 0 ||
      imageUrls.length > 0);

  async function handleSend() {
    const chosen = users.filter((u) => selected.has(u.id));
    if (!chosen.length) return alert("Escolhe destinatários");

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
                projectId: chosenTemplate?.projectId, // <-- REQUIRED BY SERVER
                name: tplName.trim(),
                languageCode: (tplLang || "pt").trim(),
                params: orderedParamValues, // values (in order)
                varKeys: varDefs.length ? varDefs.map((v) => v.key) : [], // keys (same order)
                manualParams: varDefs.length ? undefined : tplParamsManual, // fallback CSV
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
        alert(data?.error || "Falha ao mandar mensagem.");
      }
    } catch (err) {
      console.error(err);
      alert("Alguma coisa correu mal: " + err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleSendTemplateOnly() {
    const chosen = users.filter((u) => selected.has(u.id));
    if (!chosen.length) return alert("Escolhe destinatários");
    if (!tplName.trim() || !paramsComplete)
      return alert("Completa os parâmetros do template.");

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
          // Build key=value pairs in the template's variable order
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
              // templateId: chosenTemplate?.id, // optional, no longer used by server
              templateName: tplName.trim(),
              languageCode: (tplLang || "pt").trim(),
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
      alert("Alguma coisa correu mal: " + err.message);
    } finally {
      setSending(false);
    }
  }

  const allOnPageSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  const StatusPill = ({ s }) => (
    <span
      className={
        styles.pill +
        " " +
        (s === "ACTIVE"
          ? styles.pillOk
          : s === "INACTIVE"
          ? styles.pillBad
          : styles.pillInfo)
      }
    >
      {s}
    </span>
  );

  return (
    <div className={styles.screen}>
      <div className={styles.headerRow}>
        <h1>Broadcast WhatsApp</h1>
        <div className={styles.actionsRight}>
          <div className={styles.selectedLabel}>
            Selecionados: <strong>{selected.size}</strong>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !canSend}
            className={styles.primaryBtn}
          >
            {sending ? "A enviar…" : "Enviar via WhatsApp"}
          </button>
          <button
            onClick={handleSendTemplateOnly}
            disabled={
              sending ||
              selected.size === 0 ||
              !tplName.trim() ||
              !paramsComplete
            }
            className={styles.ghostBtn}
          >
            {sending ? "A enviar…" : "Enviar só template"}
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        {/* LEFT: Message + Template */}
        <div className={styles.leftCol}>
          {/* Message */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Mensagem (opcional)</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Escreve a tua mensagem (opcional se só enviares imagens)"
              className={styles.textarea}
            />
            <div className={styles.imagesRow}>
              <label className={styles.label}>Imagens</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePickFiles}
              />
            </div>
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

          {/* Template (always visible) */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>
              Template (reabre janela 24h)
            </div>

            {tplErr && <div className={styles.errorBox}>{tplErr}</div>}

            <div className={styles.templateRow}>
              <div className={styles.field}>
                <div className={styles.label}>Template</div>
                <select
                  disabled={tplLoading || nameOptions.length === 0}
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className={styles.select}
                >
                  {nameOptions.length === 0 ? (
                    <option value="">Sem templates</option>
                  ) : (
                    nameOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className={styles.fieldSm}>
                <div className={styles.label}>Idioma</div>
                <select
                  disabled={tplLoading || !tplName}
                  value={tplLang}
                  onChange={(e) => setTplLang(e.target.value)}
                  className={styles.select}
                >
                  {(languagesForChosenName || []).map((t) => (
                    <option key={`${t.name}-${t.language}`} value={t.language}>
                      {t.language}
                    </option>
                  ))}
                </select>
              </div>

              {chosenTemplate && (
                <div className={styles.meta}>
                  <span className={styles.metaItem}>
                    <strong>Categoria:</strong> {chosenTemplate.category || "-"}
                  </span>
                  <span className={styles.metaItem}>
                    <strong>Status:</strong>{" "}
                    <StatusPill s={chosenTemplate.status} />
                  </span>
                </div>
              )}
            </div>

            {/* Dynamic variable fields or fallback */}
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
                        {v.characterLimit ? ` · máx ${v.characterLimit}` : ""}
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
                    Todos os parâmetros são obrigatórios para este template.
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.fieldWide}>
                <label className={styles.smallLabel}>
                  Parâmetros (key=value, separados por vírgula)
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
                  Variável do botão URL
                </label>
                <input
                  value={tplUrlVar}
                  onChange={(e) => setTplUrlVar(e.target.value)}
                  placeholder="session-12345"
                  className={styles.input}
                />
              </div>
            )}

            {(preview.body || preview.buttonText || preview.buttonUrl) && (
              <div className={styles.preview}>
                <div className={styles.previewHeader}>Pré-visualização</div>

                <div className={styles.waFrame}>
                  <div className={styles.waHeader}>
                    <div className={styles.waAvatar}>U</div>
                    <div className={styles.waHeaderText}>
                      <div className={styles.waTitle}>
                        {sampleRecipient?.name || "Utilizador"}
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

                {preview.buttonUrl ? (
                  <div className={styles.previewUrlHint}>
                    URL: {preview.buttonUrl}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Recipients */}
        <div className={styles.rightCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitleRow}>
              <div className={styles.panelTitle}>Destinatários</div>
              <button onClick={toggleAllCurrent} className={styles.kbdBtn}>
                {allOnPageSelected
                  ? "Desselecionar página"
                  : "Selecionar página"}
              </button>
            </div>

            <div className={styles.searchWrap}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Procurar nome ou telefone…"
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
                      <div className={styles.name}>{u.name || "Sem nome"}</div>
                      <div className={styles.subline}>{u.phone_number}</div>
                    </div>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className={styles.empty}>Sem utilizadores.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className={styles.resultWrap}>
          <div className={styles.resultSummary}>
            <strong>Resultado:</strong> {result.ok} enviados, {result.failed}{" "}
            falharam
          </div>
          <div className={styles.resultBox}>
            {Array.isArray(result.results) &&
              result.results.map((r, idx) => (
                <div key={idx} className={styles.resultRow}>
                  <div>{String(r.to || "")}</div>
                  <div className={r.ok ? styles.ok : styles.bad}>
                    {r.ok ? "OK" : "Falhou"}
                  </div>
                  <pre className={styles.resultPre}>
                    {JSON.stringify(r.data, null, 2)}
                  </pre>
                </div>
              ))}
          </div>
          <div className={styles.resultNote}>{result.note}</div>
        </div>
      )}
    </div>
  );
}
