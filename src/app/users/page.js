// app/users/page.js
"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./users.module.css";
import CreateUserModal from "./CreateUser";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";

function initial(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set()); // selected ids (checkboxes)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoader();

  useEffect(() => {
    (async () => {
      startLoading();
      try {
        const res = await fetch(`/api/users?orgId=${1}`);
        const data = await res.json();
        setUsers(data);
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
        email: u.email ?? "", // TODO: wire real email if you have it
        tags: u.tags ?? ["IT", "Grupo 2"], // TODO: replace with real tags array
        assistantName: u.assistantName ?? "Assistente Geral", // TODO: wire from DB
      })),
    [users]
  );

  const filtered = normalized.filter((u) =>
    (u.name + " " + u.phone + " " + u.email)
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  const allVisibleIds = filtered.map((u) => u.id);
  const allChecked =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  function toggleAll() {
    const next = new Set(selected);
    if (allChecked) {
      allVisibleIds.forEach((id) => next.delete(id));
    } else {
      allVisibleIds.forEach((id) => next.add(id));
    }
    setSelected(next);
  }

  function toggleOne(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function handleCreateUser({ userName, phoneNumber }) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: 1, phoneNumber, name: userName }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error(`Error creating user: ${err.error}`);
      return;
    }
    const updated = await fetch(`/api/users?orgId=${1}`).then((r) => r.json());
    setUsers(updated);
    setIsModalOpen(false);
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
          className={styles.iconBtnPrimary}
          title="Novo utilizador"
          aria-label="Novo utilizador"
          onClick={() => setIsModalOpen(true)}
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

        <div className={styles.viewBtns}>
          <button className={styles.iconBtn} title="Lista" aria-label="Lista">
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
          <button className={styles.iconBtn} title="Grelha" aria-label="Grelha">
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

      {/* Table */}
      <div className={styles.table}>
        {/* Header */}
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

        {/* Rows */}
        {filtered.map((u, i) => {
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

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateUser={handleCreateUser}
      />
    </div>
  );
}
