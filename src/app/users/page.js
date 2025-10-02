"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./users.module.css";
import CreateUserModal from "./CreateUser";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";
import ManageTagsModal from "./ManageTagsModal/ManageTagsModal";
import QuickActionsModal from "./QuickActions/QuickActions";

function initial(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const plusRef = useRef(null);

  // NEW: list | grid (persisted)
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "list";
    return localStorage.getItem("usersView") || "list";
  });

  const { startLoading, stopLoading } = useGlobalLoader();
  const ORG_ID = 1;

  useEffect(() => {
    localStorage.setItem("usersView", view);
  }, [view]);

  async function refreshUsers() {
    const res = await fetch(`/api/users?orgId=${ORG_ID}`);
    const data = await res.json();
    setUsers(data);
  }

  useEffect(() => {
    (async () => {
      startLoading();
      try {
        await refreshUsers();
      } catch (e) {
        console.error(e);
      } finally {
        stopLoading();
      }
    })();
  }, [startLoading, stopLoading]);

  const normalized = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone_number ?? u.phoneNumber ?? "",
        email: u.email ?? "",
        // if you later join tags in the API, map them here
        tags: u.tags ?? [],
        assistantName: u.assistantName ?? "Assistente Geral",
      })),
    [users]
  );

  const filtered = useMemo(
    () =>
      normalized.filter((u) =>
        (u.name + " " + u.phone + " " + u.email)
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [normalized, q]
  );

  const visible = filtered;

  // selection helpers …
  const allVisibleIds = visible.map((u) => u.id);
  const allChecked =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  function toggleAll() {
    /* unchanged */
  }
  function toggleOne(id) {
    /* unchanged */
  }

  async function handleCreateUser({ userName, phoneNumber }) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: ORG_ID,
        phoneNumber,
        name: userName,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error(`Error creating user: ${err.error}`);
      return;
    }
    await refreshUsers();
    setIsCreateOpen(false);
    setIsActionsOpen(false);
  }

  return (
    <div className={styles.usersScreen}>
      {/* Toolbar */}
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
            placeholder="Procurar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <button className={styles.iconBtn} title="Filtrar" aria-label="Filtrar">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            fill="none"
          >
            <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" strokeWidth="2" />
          </svg>
        </button>

        <button
          ref={plusRef}
          className={styles.iconBtnPrimary}
          title="Ações Rápidas"
          aria-label="Ações Rápidas"
          onClick={() => setIsActionsOpen((v) => !v)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            fill="none"
          >
            <path d="M12 5v14M5 12h14" strokeWidth="2" />
          </svg>
        </button>

        {/* View switch */}
        <div className={styles.viewBtns}>
          <button
            className={`${styles.iconBtn} ${
              view === "list" ? styles.viewActive : ""
            }`}
            aria-pressed={view === "list"}
            title="Lista"
            onClick={() => setView("list")}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              fill="none"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" />
            </svg>
          </button>
          <button
            className={`${styles.iconBtn} ${
              view === "grid" ? styles.viewActive : ""
            }`}
            aria-pressed={view === "grid"}
            title="Grelha"
            onClick={() => setView("grid")}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              fill="none"
            >
              <path
                d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.header}`}>
            <div className={styles.cellChk}>
              <label className={styles.chkWrap}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                />
                <span className={styles.chkFake} />
              </label>
            </div>
            <div className={styles.cellHead}>Nome</div>
            <div className={styles.cellHead}>Nº. Telemóvel</div>
            <div className={styles.cellHead}>Tags</div>
            <div className={styles.cellHead}>Assistente</div>
            <div className={styles.cellHeadRight} />
          </div>

          {visible.map((u, i) => {
            const extra = Math.max(0, (u.tags?.length || 0) - 2);
            return (
              <div
                key={u.id}
                className={`${styles.row} ${i % 2 ? styles.rowAlt : ""}`}
              >
                <div className={styles.cellChk}>
                  <label className={styles.chkWrap}>
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleOne(u.id)}
                    />
                    <span className={styles.chkFake} />
                  </label>
                </div>

                <div className={styles.cellName}>
                  <div className={styles.avatar}>{initial(u.name)}</div>
                  <div className={styles.nameBlock}>
                    <div className={styles.name}>{u.name}</div>
                    <div className={styles.subline}>
                      {u.email || u.phone || "—"}
                    </div>
                  </div>
                </div>

                <div className={styles.cellPhone}>{u.phone || "—"}</div>

                <div className={styles.cellTags}>
                  {(u.tags || []).slice(0, 2).map((t) => (
                    <span key={t} className={styles.chip}>
                      {t}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className={`${styles.chip} ${styles.chipDark}`}>
                      +{extra}
                    </span>
                  )}
                </div>

                <div className={styles.cellAssistant}>
                  <button className={styles.chipBtn}>
                    {u.assistantName || "—"}
                  </button>
                </div>

                <div className={styles.cellKebab}>
                  <button className={styles.iconBtn} aria-label="Mais opções">
                    •••
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GRID (CARD) VIEW */}
      {view === "grid" && (
        <div className={styles.gridScroll}>
          <div className={styles.grid}>
            {visible.map((u) => {
              const extra = Math.max(0, (u.tags?.length || 0) - 2);
              return (
                <div key={u.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <label className={styles.chkWrapSm}>
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                      />
                      <span className={styles.chkFakeSm} />
                    </label>
                    <button
                      className={styles.iconBtnGhost}
                      aria-label="Mais opções"
                    >
                      •••
                    </button>
                  </div>

                  <div className={styles.cardTitle}>{u.name}</div>
                  <div className={styles.cardEmail}>{u.email || "—"}</div>

                  <div className={styles.cardTags}>
                    {(u.tags || []).slice(0, 2).map((t) => (
                      <span key={t} className={styles.chip}>
                        {t}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className={`${styles.chip} ${styles.chipDark}`}>
                        +{extra}
                      </span>
                    )}
                  </div>

                  <div className={styles.cardPhone}>
                    <span className={styles.flag} aria-hidden>
                      🇵🇹
                    </span>
                    <span>{u.phone || "—"}</span>
                  </div>

                  <div className={styles.cardFooter}>
                    <button className={styles.chipBtn}>
                      {u.assistantName || "—"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <QuickActionsModal
        anchorEl={plusRef.current}
        open={isActionsOpen}
        onClose={() => setIsActionsOpen(false)}
        onChoose={(which) => {
          if (which === "create") setIsCreateOpen(true);
          if (which === "tags") setIsTagsOpen(true);
        }}
      />

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreateUser={handleCreateUser}
      />

      <ManageTagsModal
        isOpen={isTagsOpen}
        orgId={ORG_ID}
        onClose={() => setIsTagsOpen(false)}
      />
    </div>
  );
}
