"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  CalendarClock,
  ChevronDown,
  Clock3,
  Eye,
  MessageSquare,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserPlus,
} from "lucide-react";
import styles from "./automations.module.css";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import { RuleModal } from "./RuleModal/RuleModal";

const TRIGGER_OPTIONS = [
  {
    value: "user.created",
    label: "User created",
    icon: UserPlus,
    description: "Send X minutes after a user is created.",
  },
  {
    value: "user.inactive",
    label: "User inactive",
    icon: Clock3,
    description: "Send X minutes without a user inbound message.",
  },
  {
    value: "message.read",
    label: "Message read",
    icon: Eye,
    description: "Reserved for future read-receipt automations.",
    disabled: true,
  },
  {
    value: "message.unread",
    label: "Message unread",
    icon: MessageSquare,
    description: "Reserved for future read-receipt automations",
    disabled: true,
  },
];

const STATUS_META = {
  queued: { label: "Queued", className: styles.chipDark },
  materialized: { label: "Materialized", className: styles.chip },
  processing: { label: "Processing", className: styles.chip },
  sent: { label: "Sent", className: styles.chipSuccess || styles.chip },
  failed: { label: "Failed", className: styles.rowActBtnDanger },
  cancelled: { label: "Cancelled", className: styles.chipDark },
  skipped: { label: "Skipped", className: styles.chipDark },
};

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function triggerLabel(value) {
  return TRIGGER_OPTIONS.find((t) => t.value === value)?.label || value;
}

function safeJsonParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function summarizeMessage(payload) {
  const p = safeJsonParse(payload, {});
  return p.messageResolved || p.message || "-";
}

function RunStatusChip({ status }) {
  const meta = STATUS_META[status] || {
    label: status || "-",
    className: styles.chipDark,
  };
  return (
    <span className={`${styles.chip} ${meta.className || ""}`}>
      {meta.label}
    </span>
  );
}

export default function AutomationsPage() {
  const translation = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { startLoading, stopLoading } = useGlobalLoader();
  const confirm = useConfirm();

  const [rules, setRules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("rules");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  const orgId = org?.id;

  const assistantsById = useMemo(() => {
    const map = new Map();
    assistants.forEach((a) => map.set(Number(a.id), a));
    return map;
  }, [assistants]);

  const ruleMap = useMemo(() => {
    const map = new Map();
    rules.forEach((r) => map.set(r.id, r));
    return map;
  }, [rules]);

  const refreshAll = useCallback(async () => {
    if (!orgId) return;

    startLoading();
    try {
      const [rulesRes, runsRes, assistantsRes, templatesRes] =
        await Promise.all([
          fetch(`/api/automations/rules?orgId=${orgId}`),
          fetch(`/api/automations/runs?orgId=${orgId}&limit=100`),
          fetch(`/api/assistants?orgId=${orgId}`),
          fetch(`/api/template/list?orgId=${orgId}`),
        ]);

      const [rulesData, runsData, assistantsData, templatesData] =
        await Promise.all([
          rulesRes.json(),
          runsRes.json(),
          assistantsRes.json(),
          templatesRes.json(),
        ]);

      setRules(Array.isArray(rulesData?.items) ? rulesData.items : []);
      setRuns(Array.isArray(runsData?.items) ? runsData.items : []);
      setAssistants(Array.isArray(assistantsData) ? assistantsData : []);
      setTemplates(
        Array.isArray(templatesData?.items) ? templatesData.items : [],
      );
    } finally {
      stopLoading();
    }
  }, [orgId, startLoading, stopLoading]);

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;
    refreshAll();
  }, [authLoading, orgLoading, orgId, refreshAll]);

  useEffect(() => {
    if (!createMenuOpen) return;

    function handleClickOutside(e) {
      if (!createMenuRef.current?.contains(e.target)) {
        setCreateMenuOpen(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") setCreateMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [createMenuOpen]);

  const filteredRules = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rules;

    return rules.filter((rule) => {
      const payload = safeJsonParse(rule.payload, {});
      const haystack = [
        rule.name,
        rule.channel,
        rule.trigger_type,
        payload.message || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [q, rules]);

  const filteredRuns = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return runs;

    return runs.filter((run) => {
      const relatedRule = ruleMap.get(run.rule_id);
      const haystack = [
        relatedRule?.name || "",
        run.channel,
        run.trigger_type,
        run.status,
        summarizeMessage(run.payload),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [q, runs, ruleMap]);

  async function handleSaveRule(ruleInput) {
    if (!orgId) return;

    setSaving(true);
    try {
      const endpoint = ruleInput.id
        ? `/api/automations/rules/${ruleInput.id}`
        : "/api/automations/rules";

      const method = ruleInput.id ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          ...ruleInput,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save automation rule");
      }

      setModalOpen(false);
      setEditingRule(null);
      await refreshAll();
    } catch (error) {
      alert(error.message || "Failed to save automation rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRule(rule) {
    const ok = await confirm({
      title: `Delete \"${rule.name}\"?`,
      message:
        "This will remove the automation rule. Existing runs stay in history.",
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });

    if (!ok) return;

    const res = await fetch(`/api/automations/rules/${rule.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Failed to delete automation rule");
      return;
    }

    await refreshAll();
  }

  async function toggleRule(rule) {
    const res = await fetch(`/api/automations/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Failed to update automation rule");
      return;
    }

    await refreshAll();
  }

  async function runCron(path) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_CRON_SECRET
          ? {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
            }
          : {}),
      },
      body: JSON.stringify({ limit: 100 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || "Cron failed");
      return;
    }

    await refreshAll();
  }

  return (
    <div className={styles.usersScreen}>
      <div className={styles.toolbarRow}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="7" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
            </svg>
          </span>
          <input
            className={styles.searchInputXL}
            placeholder="Search automations"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search automations"
          />
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            onClick={() => refreshAll()}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            onClick={() => runCron("/api/cron/automations/inactivity")}
          >
            <Clock3 size={16} />
            <span>Run inactivity</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            onClick={() => runCron("/api/cron/automations/materialize")}
          >
            <PlayCircle size={16} />
            <span>Materialize</span>
          </button>

          <div className={styles.createMenuWrap} ref={createMenuRef}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => setCreateMenuOpen((v) => !v)}
            >
              <Plus size={16} />
              <span>New automation</span>
              <ChevronDown size={16} />
            </button>

            {createMenuOpen && (
              <div className={styles.createMenu} role="menu">
                <button
                  type="button"
                  className={styles.createMenuItem}
                  onClick={() => {
                    setCreateMenuOpen(false);
                    setEditingRule(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus size={16} />
                  <span>Create automation</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.activeFilters}>
        <button
          className={`${styles.filterChip} ${tab === "rules" ? styles.filterChipActive : ""}`}
          onClick={() => setTab("rules")}
        >
          Rules ({rules.length})
        </button>
        <button
          className={`${styles.filterChip} ${tab === "runs" ? styles.filterChipActive : ""}`}
          onClick={() => setTab("runs")}
        >
          Runs ({runs.length})
        </button>
      </div>

      {tab === "rules" ? (
        <div className={styles.tableCard}>
          <div className={styles.table}>
            <div className={`${styles.row} ${styles.header}`}>
              <div className={styles.cellHead}>Name</div>
              <div className={styles.cellHead}>Trigger</div>
              <div className={styles.cellHead}>Channel</div>
              <div className={styles.cellHead}>Delay</div>
              <div className={styles.cellHead}>Assistant</div>
              <div className={styles.cellHead}>Message</div>
              <div className={styles.cellHeadRight} />
            </div>

            {filteredRules.map((rule, i) => {
              const assistant = rule.assistant_id
                ? assistantsById.get(Number(rule.assistant_id))
                : null;
              const payload = safeJsonParse(rule.payload, {});
              const TriggerIcon =
                TRIGGER_OPTIONS.find((t) => t.value === rule.trigger_type)
                  ?.icon || Bot;

              return (
                <div
                  key={rule.id}
                  className={`${styles.row} ${i % 2 ? styles.rowAlt : ""}`}
                >
                  <div className={styles.cellName}>
                    <div className={styles.avatar}>
                      <TriggerIcon size={16} />
                    </div>
                    <div className={styles.nameBlock}>
                      <div className={styles.name}>{rule.name}</div>
                      <div className={styles.subline}>
                        {rule.is_active ? "Active" : "Paused"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.cellPhone}>
                    {triggerLabel(rule.trigger_type)}
                  </div>
                  <div className={styles.cellPhone}>{rule.channel}</div>
                  <div className={styles.cellPhone}>
                    {rule.delay_minutes} min
                  </div>
                  <div className={styles.cellPhone}>
                    {assistant?.name || "Any"}
                  </div>
                  <div className={styles.cellTags}>
                    <div
                      className={styles.messagePreview}
                      title={payload.message || "-"}
                    >
                      {payload.message || "-"}
                    </div>
                  </div>

                  <div className={styles.cellKebab}>
                    <button
                      className={styles.rowActBtn}
                      onClick={() => toggleRule(rule)}
                      title={rule.is_active ? "Pause" : "Activate"}
                    >
                      {rule.is_active ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </button>
                    <button
                      className={styles.rowActBtn}
                      onClick={() => {
                        setEditingRule(rule);
                        setModalOpen(true);
                      }}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`${styles.rowActBtn} ${styles.rowActBtnDanger}`}
                      onClick={() => handleDeleteRule(rule)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.table}>
            <div className={`${styles.row} ${styles.header}`}>
              <div className={styles.cellHead}>Rule</div>
              <div className={styles.cellHead}>Trigger</div>
              <div className={styles.cellHead}>Channel</div>
              <div className={styles.cellHead}>Scheduled for</div>
              <div className={styles.cellHead}>Status</div>
              <div className={styles.cellHead}>Message</div>
            </div>

            {filteredRuns.map((run, i) => {
              const rule = ruleMap.get(run.rule_id);
              return (
                <div
                  key={run.id}
                  className={`${styles.row} ${i % 2 ? styles.rowAlt : ""}`}
                >
                  <div className={styles.cellName}>
                    <div className={styles.avatar}>
                      <CalendarClock size={16} />
                    </div>
                    <div className={styles.nameBlock}>
                      <div className={styles.name}>
                        {rule?.name || "Deleted rule"}
                      </div>
                      <div className={styles.subline}>
                        {run.user_row?.name || `User #${run.user_id}`}
                      </div>
                    </div>
                  </div>
                  <div className={styles.cellPhone}>
                    {triggerLabel(run.trigger_type)}
                  </div>
                  <div className={styles.cellPhone}>{run.channel}</div>
                  <div className={styles.cellPhone}>
                    {formatDateTime(run.scheduled_for)}
                  </div>
                  <div className={styles.cellPhone}>
                    <RunStatusChip status={run.status} />
                  </div>
                  <div className={styles.cellTags}>
                    <div
                      className={styles.messagePreview}
                      title={summarizeMessage(run.payload)}
                    >
                      {summarizeMessage(run.payload)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RuleModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSaveRule}
        assistants={assistants}
        whatsappTemplates={templates}
        initialRule={editingRule}
        saving={saving}
        triggerOptions={TRIGGER_OPTIONS}
        safeJsonParse={safeJsonParse}
      />
    </div>
  );
}
