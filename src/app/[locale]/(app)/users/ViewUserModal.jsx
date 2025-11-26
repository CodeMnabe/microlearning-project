// app/[locale]/(app)/users/ViewUserModal.jsx
"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./users.module.css";
import { Pencil, X, RefreshCcw } from "lucide-react";

function initial(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

function formatPhoneDisplay(user) {
  const code = user.phoneCountryCode || user.phone_country_code || "";
  const nat = user.phoneNational || user.phone_national || "";
  if (code || nat) return `${code} ${nat}`.trim();
  return user.phone || user.phone_national || "—";
}

export default function ViewUserModal({
  open,
  onClose,
  user,
  orgId,
  onEdit,
  assistantsById,
}) {
  const [render, setRender] = useState(open);

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState("");

  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");

  // ---- NEW: request guards to avoid stale updates ----
  const threadsReqId = useRef(0);
  const messagesReqId = useRef(0);

  // keep mounted during close animation
  useEffect(() => {
    if (open) setRender(true);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!render) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [render, onClose]);

  // ---- NEW: hard reset on CLOSE so next open starts clean ----
  useEffect(() => {
    if (open) return;
    // invalidate in-flight requests
    threadsReqId.current++;
    messagesReqId.current++;

    // clear all state
    setThreads([]);
    setSelectedThreadId(null);
    setMessages([]);
    setThreadsError("");
    setMessagesError("");
  }, [open]);

  // Reset + load threads on open/user change
  useEffect(() => {
    if (!open || !user?.id) return;

    // clear before loading (prevents flash of old data)
    setThreads([]);
    setSelectedThreadId(null);
    setMessages([]);
    setThreadsError("");
    setMessagesError("");

    loadThreads(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  async function loadThreads(userId) {
    const reqId = ++threadsReqId.current;
    try {
      setThreadsLoading(true);
      setThreadsError("");

      const res = await fetch(`/api/threads?userId=${userId}`);
      if (!res.ok) throw new Error(await safeText(res));

      const data = await res.json();
      const list = Array.isArray(data?.threads) ? data.threads : [];
      const normalized = list.map((t) => ({
        id: t.id, // DB thread id (int)
        aiThreadId: t.ai_thread_id || "",
        assistantId: t.assistant_id ?? null,
        createdAt: t.created_at ?? null,
      }));

      // ignore if a newer request was started meanwhile
      if (reqId !== threadsReqId.current) return;

      setThreads(normalized);
      setSelectedThreadId(normalized.length ? normalized[0].id : null);
    } catch (err) {
      if (reqId !== threadsReqId.current) return;
      setThreadsError(err?.message || "Erro ao carregar threads.");
    } finally {
      if (reqId === threadsReqId.current) setThreadsLoading(false);
    }
  }

  // Load messages when thread changes
  useEffect(() => {
    if (!open || !selectedThreadId) {
      // ensure empty UI when nothing selected
      setMessages([]);
      return;
    }
    loadMessages(selectedThreadId);
  }, [open, selectedThreadId]);

  async function loadMessages(threadId) {
    const reqId = ++messagesReqId.current;
    try {
      setMessagesLoading(true);
      setMessagesError("");

      // Preferred: flat endpoint
      let res = await fetch(`/api/messages?threadId=${threadId}`);
      if (!res.ok) res = await fetch(`/api/threads/${threadId}/messages`);
      if (!res.ok) throw new Error(await safeText(res));

      const data = await res.json();
      const arr = Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data)
        ? data
        : [];

      const normalized = arr.map((m) => ({
        id: m.id,
        role: m.role || "assistant",
        createdAt: m.created_at ?? null,
        text: extractText(m),
      }));

      if (reqId !== messagesReqId.current) return;
      setMessages(normalized);
    } catch (err) {
      if (reqId !== messagesReqId.current) return;
      setMessagesError(err?.message || "Erro ao carregar mensagens.");
      setMessages([]);
    } finally {
      if (reqId === messagesReqId.current) setMessagesLoading(false);
    }
  }

  const getAssistantName = (id) =>
    (id == null ? null : assistantsById?.get(String(id))?.name) || "_";

  const stateClass = open ? styles.open : styles.closing;
  if (!render || !user) return null;

  return (
    <div
      className={`${styles.modalOverlay} ${stateClass}`}
      role="dialog"
      aria-modal="true"
      onAnimationEnd={(e) => {
        if (!open && e.target === e.currentTarget) setRender(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* key forces a fresh subtree when the user changes */}
      <div
        key={user?.id ?? "none"}
        className={`${styles.modalContent} ${styles.modalContentWide} ${stateClass}`}
      >
        {/* Header */}
        <div className={styles.viewHead}>
          <div className={styles.viewHeadLeft}>
            <div className={styles.avatarLg}>{initial(user.name || "")}</div>
            <div className={styles.viewTitleBlock}>
              <div className={styles.viewTitle}>{user.name || "—"}</div>
              <div className={styles.viewSubtitle}>
                {user.email || "—"} &middot; {formatPhoneDisplay(user)}
              </div>
              {!!(user.tags && user.tags.length) && (
                <div className={styles.viewTagsRow}>
                  {user.tags.map((t) => (
                    <span key={t} className={styles.chip}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.viewHeadRight}>
            {!!onEdit && (
              <button
                className={styles.iconBtn}
                title="Editar"
                onClick={onEdit}
              >
                <Pencil size={18} />
              </button>
            )}
            <button className={styles.iconBtn} title="Fechar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body grid */}
        <div className={styles.viewLayout}>
          {/* Only Threads + Messages now */}
          <section className={styles.panelWide}>
            <div className={styles.threadsLayout}>
              {/* Threads list */}
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  Threads
                  <button
                    className={styles.iconBtn}
                    style={{ marginLeft: "auto" }}
                    title="Recarregar"
                    onClick={() => loadThreads(user.id)}
                    disabled={threadsLoading}
                  >
                    <RefreshCcw size={16} />
                  </button>
                </div>
                <div className={`${styles.panelBody} ${styles.threadList}`}>
                  {threadsLoading && (
                    <div className={styles.emptyNote}>A carregar…</div>
                  )}
                  {!threadsLoading && threadsError && (
                    <div className={styles.errorNote}>{threadsError}</div>
                  )}
                  {!threadsLoading && !threadsError && !threads.length && (
                    <div className={styles.emptyNote}>
                      Este utilizador não tem threads.
                    </div>
                  )}
                  {!threadsLoading &&
                    !threadsError &&
                    threads.map((t) => {
                      const active = selectedThreadId === t.id;
                      return (
                        <button
                          key={t.id}
                          className={`${styles.threadItem} ${
                            active ? styles.threadItemActive : ""
                          }`}
                          onClick={() => setSelectedThreadId(t.id)}
                          title={t.aiThreadId}
                        >
                          <div className={styles.threadTitle}>
                            {getAssistantName(t.assistantId)}
                          </div>
                          <div className={styles.threadMeta}>
                            {formatWhen(t.createdAt)}
                          </div>
                          <div className={styles.threadIdMono}>
                            {shortId(t.aiThreadId)}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Messages viewer */}
              <div className={styles.panel}>
                <div className={styles.panelHead}>Mensagens</div>
                <div className={`${styles.panelBody} ${styles.messagesPane}`}>
                  {messagesLoading && (
                    <div className={styles.emptyNote}>A carregar…</div>
                  )}
                  {!messagesLoading && messagesError && (
                    <div className={styles.errorNote}>{messagesError}</div>
                  )}
                  {!messagesLoading && !messagesError && !messages.length && (
                    <div className={styles.emptyNote}>Sem mensagens.</div>
                  )}
                  {!messagesLoading && !messagesError && !!messages.length && (
                    <div className={styles.messagesScroll}>
                      {messages.map((m) => (
                        <MessageBubble
                          key={m.id}
                          role={m.role}
                          when={m.createdAt}
                          text={m.text}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function extractText(m) {
  // DB rows use `content`
  if (m?.content) return String(m.content);
  if (typeof m?.text === "string") return m.text;

  // OpenAI-style fallbacks
  if (typeof m?.content === "string") return m.content;
  if (Array.isArray(m?.content)) {
    const firstText =
      m.content.find((c) => typeof c === "string") ||
      m.content.find((c) => c?.type === "text" && (c.text?.value || c.text));
    if (typeof firstText === "string") return firstText;
    if (firstText?.text?.value) return firstText.text.value;
    if (firstText?.text) return firstText.text;
  }
  return "(sem texto)";
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "Erro";
  }
}

function shortId(id) {
  if (!id) return "";
  const s = String(id);
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function MessageBubble({ role = "assistant", when, text }) {
  const mine = role === "user";
  return (
    <div
      className={`${styles.msgRow} ${mine ? styles.msgMine : styles.msgTheirs}`}
    >
      <div className={styles.msgBubble}>
        <div className={styles.msgText}>{text}</div>
        <div className={styles.msgMeta}>
          <span className={styles.msgRole}>
            {mine ? "Utilizador" : "Assistente"}
          </span>
          <span>·</span>
          <span className={styles.msgWhen}>{formatWhen(when)}</span>
        </div>
      </div>
    </div>
  );
}
