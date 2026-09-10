"use client";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../../AuthContext";
import useOrganization from "../../../hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert} from "@/app/components/Alert/AlertProvider";
import TemplateComponentsEditor from "./components/TemplateComponentsEditor";
import TemplatePreview from "./components/TemplatePreview";
import {
  PRESET_KEYS,
  buildTemplateComponents,
  presetForm,
  sanitizeTemplateName,
  validateTemplateForm,
} from "./lib/templateComponents";
import styles from "./templates.module.css";

const DEFAULT_PRESET = "text_quickreplies";

export default function TemplatesPage() {
  const translation = useTranslations("Templates");
  const showAlert = useAlert();
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);

  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [items, setItems] = useState([]);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt");
  const [category, setCategory] = useState("MARKETING");
  const [form, setForm] = useState(() => presetForm(DEFAULT_PRESET));
  const [formErrors, setFormErrors] = useState([]);
  const [presetKey, setPresetKey] = useState(DEFAULT_PRESET);

  const generatedComponents = useMemo(
    () => buildTemplateComponents(form),
    [form]
  );

  // Fixed at mount so the preview does not re-render every minute.
  const [previewTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendTemplate, setSendTemplate] = useState(null);
  const [sendParams, setSendParams] = useState("");
  const [sendUrlVar, setSendUrlVar] = useState("");

  const { startLoading, stopLoading } = useGlobalLoader();

  const clearMessages = () => {
    setError(null);
    setNotice(null);
  };


const refresh = useCallback(
  async (showSuccessAlert = false) => {
    if (!org?.id) {
      if (showSuccessAlert) {
        await showAlert({
          title: translation("alerts.noOrg.title"),
      message: translation("alerts.noOrg.message"),
          tone: "warning",
        });
      }

      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const res = await fetch(`/api/template/list?orgId=${org.id}`);
      const data = await jsonOrThrow(res);

      if (!res.ok) {
        throw new Error(
          data?.error ? JSON.stringify(data.error) : `HTTP ${data.status}`
        );
      }

      const count = data.items?.length ?? 0;

      setItems(data.items || []);

      setNotice(
        translation("notices.synced", {
          count,
        })
      );

      if (showSuccessAlert) {
        await showAlert({
          title: translation("alerts.syncSuccess.title"),
          message: translation("alerts.syncSuccess.message", {
            count,
          }),
          tone: "success",
        });
      }
    } catch (e) {
      setError(
        translation("errors.fetch", {
          message: e.message,
        })
      );

      await showAlert({
        title: translation("alerts.syncFailed.title"),
        message: translation("alerts.syncFailed.message"),
        tone: "danger",
      });
    } finally {
      setLoading(false);
      stopLoading();
    }
  },
  [org?.id, stopLoading, translation, showAlert]
);


  async function jsonOrThrow(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  useEffect(() => {
    if (org?.id) refresh();
  }, [org?.id, refresh]);

  function onPresetChange(key) {
    setPresetKey(key);
    setForm(presetForm(key));
    setFormErrors([]);
  }

  function onFormChange(next) {
    setForm(next);
    if (formErrors.length) setFormErrors([]);
  }

  async function createTemplate(e) {
    e?.preventDefault?.();
    if (!org?.id) return;
    clearMessages();

    const errors = validateTemplateForm(form, { name });
    setFormErrors(errors);

    if (errors.some((err) => err.field === "name")) {
      setError(translation("errors.nameRequired"));

      await showAlert({
        title: translation("alerts.nameRequired.title"),
        message: translation("alerts.nameRequired.message"),
        tone: "warning",
      });

      return;
    }

    if (errors.length > 0) {
      setError(translation("errors.formInvalid"));

      await showAlert({
        title: translation("alerts.formInvalid.title"),
        message: translation("alerts.formInvalid.message"),
        tone: "warning",
      });

      return;
    }

    const components = buildTemplateComponents(form);

    setLoading(true);
    try {
      const res = await fetch("/api/template/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          name,
          language,
          category,
          components,
        }),
      });

      const data = await jsonOrThrow(res);
      if (!res.ok) {
        throw new Error(
          data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`
        );
      }

      setNotice(
        translation("notices.templateSubmitted", {
          name,
          status:data.template?.status || "NEW",
        })
        
      );

      await showAlert({
        title: translation("alerts.templateSubmitted.title"),
        message: translation("alerts.templateSubmitted.message", {
          name,
          status: data.template?.status || "NEW",
        }),
        tone: "success",
      });
      setView("list");
      refresh();



    } catch (err) {
  setError(
    translation("errors.createFailed", {
      message: err.message,
    })
  );

  await showAlert({
    title: translation("alerts.createFailed.title"),
    message: translation("alerts.createFailed.message"),
    tone: "danger",
  });
} finally {
      setLoading(false);
    }
  }

  function openSend(tpl) {
    setSendOpen(true);
    setSendTemplate(tpl);
    setSendTo("");
    setSendParams("");
    setSendUrlVar("");
  }

  async function sendTest(e) {
    e?.preventDefault?.();
    if (!org?.id || !sendTemplate) return;
    if (!sendTo.trim()) {
  await showAlert({
    title: translation("alerts.recipientRequired.title"),
    message: translation("alerts.recipientRequired.message"),
    tone: "warning",
  });

  return;
}
    clearMessages();

    const params = sendParams
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      orgId: org.id,
      to: sendTo,
      templateName: sendTemplate.name,
      languageCode: sendTemplate.language || "pt",
      params,
    };

    if (sendUrlVar) {
      body.components = [
        {
          type: "button",
          sub_type: "url",
          parameters: [{ type: "text", text: sendUrlVar }],
        },
      ];
    }

    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await jsonOrThrow(res);
      if (!res.ok) {
        throw new Error(
          data?.data ? JSON.stringify(data.data) : `HTTP ${res.status}`
        );
      }

      setNotice(translation("notices.sent"));
    setSendOpen(false);

    await showAlert({
      title: translation("alerts.testSent.title"),
      message: translation("alerts.testSent.message"),
      tone: "success",
    });
    } catch (err) {
      setError(
        translation("errors.sendFailed", {
          message: err.message,
        })
      );

      await showAlert({
        title: translation("alerts.testSendFailed.title"),
        message: translation("alerts.testSendFailed.message"),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

 const StatusPill = ({ s }) => {
  const rawStatus = s || "NEW";
  const statusKey = String(rawStatus).toLowerCase().replaceAll(" ", "_");

  let label;

  try {
    label = translation(`statuses.${statusKey}`);
  } catch {
    label = rawStatus;
  }

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        background:
          rawStatus === "APPROVED"
            ? "#E8F5E9"
            : rawStatus === "REJECTED"
            ? "#FFEBEE"
            : rawStatus === "PENDING"
            ? "#FFF8E1"
            : "#E3F2FD",
        color:
          rawStatus === "APPROVED"
            ? "#2E7D32"
            : rawStatus === "REJECTED"
            ? "#C62828"
            : rawStatus === "PENDING"
            ? "#F57F17"
            : "#1565C0",
      }}
    >
      {label}
    </span>
  );};

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>WhatsApp Templates</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setView("list")}
            style={tabBtn(view === "list")}
          >
    
           {translation("tabList")}
          </button>
          <button
            onClick={() => setView("create")}
            style={tabBtn(view === "create")}
          >
            {translation("tabCreate")}
          </button>
        </div>
      </header>

      {error && <div style={alertBox("#FFEBEE", "#C62828")}>{error}</div>}
      {notice && <div style={alertBox("#E8F5E9", "#2E7D32")}>{notice}</div>}

      {view === "list" ? (
        <section>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
          onClick={() => refresh(true)}
          disabled={loading}
          style={primaryBtn()}
        >
          {loading ? translation("syncing") : translation("sync")}
        </button>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                  <th style={th()}>{translation("name")}</th>
                  <th style={th(140)}>{translation("language")}</th>
                  <th style={th(160)}>{translation("category")}</th>
                  <th style={th(160)}>{translation("status")}</th>
                  <th style={th(140)}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: 16,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      {translation("noTemplates")}
                      
                    </td>
                  </tr>
                )}
                {items.map((t) => (
                 <tr
                  key={`${t.name}-${t.language}`}
                  style={{ borderTop: "1px solid #e5e7eb" }}
                >
                  <td style={td()}>{t.name}</td>
                  <td style={td(140)}>{t.language}</td>
                  <td style={td(160)}>{t.category}</td>
                  <td style={td(160)}>
                    <StatusPill status={t.status} />
                  </td>
                  <td style={td(140)}>
                    <button
                      onClick={() => openSend(t)}
                      style={secondaryBtn()}
                    >
                      {translation("sendTest")}
                    </button>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section>
          <form
            onSubmit={createTemplate}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <div
              style={{
                gridColumn: "1 / span 2",
                display: "grid",
                gridTemplateColumns: "1fr 160px 200px 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={label()}> {translation("name")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(sanitizeTemplateName(e.target.value))}
                  placeholder="ml_tip_image_v1"
                  style={input()}
                />
              </div>
              <div>
                <label style={label()}> {translation("language")}</label>
                <input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="pt"
                  style={input()}
                />
              </div>
              <div>
                <label style={label()}> {translation("category")}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={input()}
                >
                  <option value="MARKETING">{translation("MARKETING")}</option>
                  <option value="UTILITY">{translation("UTILITY")}</option>
                  <option value="AUTHENTICATION">{translation("AUTHENTICATION")}</option>
                </select>
              </div>
              <div>
                <label style={label()}> {translation("Model")}</label>
                <select
                  value={presetKey}
                  onChange={(e) => onPresetChange(e.target.value)}
                  style={input()}
                >
                  {PRESET_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {translation(key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{ gridColumn: "1 / span 2" }}
              className={styles.editorLayout}
            >
              <div className={styles.editorColumn}>
                <TemplateComponentsEditor
                  form={form}
                  onChange={onFormChange}
                  errors={formErrors}
                  disabled={loading}
                />
                <details className={styles.jsonDetails}>
                  <summary>{translation("editor.generatedJson")}</summary>
                  <pre className={styles.jsonPre}>
                    {JSON.stringify(generatedComponents, null, 2)}
                  </pre>
                </details>
              </div>
              <TemplatePreview form={form} time={previewTime} />
            </div>

            <div style={{ gridColumn: "1 / span 2", display: "flex", gap: 8 }}>
              <button type="submit" disabled={loading} style={primaryBtn()}>
                {loading
                  ? translation("createForm.creating")
                  : translation("createForm.submit")}
              </button>
              <button
                type="button"
                onClick={() => onPresetChange(presetKey)}
                style={secondaryBtn()}
              >
                {translation("createForm.reset")}
              </button>
            </div>
          </form>
        </section>
      )}

      {sendOpen && (
        <div style={modalWrap()}>
          <div style={modalCard()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Enviar teste</h3>
              <button onClick={() => setSendOpen(false)} style={ghostBtn()}>
                Fechar
              </button>
            </div>
            <div style={{ color: "#6b7280", marginBottom: 12 }}>
              {sendTemplate?.name} · {sendTemplate?.language} ·{" "}
              {sendTemplate?.category}
            </div>
            <form onSubmit={sendTest}>
              <label style={label()}>Para (E.164 ou nacional)</label>
              <input
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="+3519XXXXXXXX"
                style={input()}
              />

              <div style={{ height: 8 }} />

              <label style={label()}>
                Parâmetros do corpo (separados por vírgula)
              </label>
              <input
                value={sendParams}
                onChange={(e) => setSendParams(e.target.value)}
                placeholder="João, Verificar pressão dos pneus"
                style={input()}
              />

              <div style={{ height: 8 }} />

              <label style={label()}>Variável do botão URL (opcional)</label>
              <input
                value={sendUrlVar}
                onChange={(e) => setSendUrlVar(e.target.value)}
                placeholder="session-12345"
                style={input()}
              />

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSendOpen(false)}
                  style={secondaryBtn()}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={primaryBtn()}>
                  {loading ? "A enviar…" : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- UI helpers ----------
function tabBtn(active) {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    cursor: "pointer",
  };
}
function primaryBtn() {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
  };
}
function secondaryBtn() {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
  };
}
function ghostBtn() {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer",
  };
}
function th(w) {
  return {
    padding: 12,
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    width: w,
  };
}
function td(w) {
  return {
    padding: 12,
    width: w,
    fontSize: 14,
    color: "#111827",
  };
}
function input() {
  return {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    outline: "none",
  };
}
function label() {
  return {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 6,
  };
}
function alertBox(bg, fg) {
  return {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    background: bg,
    color: fg,
    whiteSpace: "pre-wrap",
  };
}
function modalWrap() {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
}
function modalCard() {
  return {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    width: 520,
    maxWidth: "100%",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
  };
}

