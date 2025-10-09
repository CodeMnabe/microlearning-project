"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "./users.module.css";
import CreateUserModal from "./CreateUser";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import ManageTagsModal from "./ManageTagsModal/ManageTagsModal";
import QuickActionsModal from "./QuickActions/QuickActions";
import RowActionsMenu from "./RowActionsMenu";
import EditUserModal from "./EditUserModal";
import { MoreHorizontal } from "lucide-react";
import useOrganization from "@/app/hooks/useOrganization";
import { useAuth } from "@/app/AuthContext";

function initial(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [assistantsList, setAssistantsList] = useState([]);
  const [rowMenu, setRowMenu] = useState({
    open: false,
    anchor: null,
    user: null,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const plusRef = useRef(null);

  // how many tags to show before "+n"
  const MAX_TAGS = 6;

  // NEW: list | grid (persisted)
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "list";
    return localStorage.getItem("usersView") || "list";
  });

  const { startLoading, stopLoading } = useGlobalLoader();

  useEffect(() => {
    localStorage.setItem("usersView", view);
  }, [view]);

  const orgId = org?.id;

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;
    (async () => {
      const res = await fetch(`/api/assistants?orgId=${orgId}`);
      const data = await res.json();
      setAssistantsList(data || []);
    })().catch(console.error);
  }, [authLoading, orgLoading, orgId, users]);

  const refreshUsers = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(`/api/users?orgId=${orgId}`);
    const data = await res.json();
    console.log(data);
    setUsers(data);
  }, [orgId]);

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;
    startLoading();
    refreshUsers().finally(stopLoading);
  }, [authLoading, orgLoading, orgId, refreshUsers, startLoading, stopLoading]);

  const normalized = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone_number ?? u.phoneNumber ?? "",
        email: u.email ?? "",
        // for chips in the list:
        tags: u.tag_names ?? (u.tags || []).map((t) => t.name) ?? [],
        // for editing:
        tagIds: u.tag_ids ?? (u.tags || []).map((t) => t.id) ?? [],
        assistantId: u.assistant_id ?? null,
        assistantName: u.assistantName ?? "—",
        organization_id: u.organization_id, // handy for modal fetch
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
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        // unselect all visible
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        // select all visible
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateUser({ userName, phoneNumber, assistantId }) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: org.id,
        phoneNumber,
        name: userName,
        assistantId,
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

  function AssistantPicker({ value, assistants, onChange }) {
    return (
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value ? Number(e.target.value) : null)
        }
        style={{
          padding: "6px 10px",
          borderRadius: 9999,
          border: "1px solid #9fd3ff",
          background: "#eaf6ff",
          fontWeight: 700,
          color: "#1467a3",
        }}
        title="Escolher assistente"
      >
        {/* <option value="">— Sem assistente —</option> */}
        {assistants.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    );
  }

  function openRowMenu(user, anchorEl) {
    setRowMenu({ open: true, anchor: anchorEl, user });
  }

  function closeRowMenu() {
    setRowMenu({ open: false, anchor: null, user: null });
  }

  async function deleteUserById(id) {
    if (!confirm("Eliminar este utilizador")) return;
    const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      console.error(await res.text());
      return;
    }
    await refreshUsers();
  }

  function openEditFor(user) {
    setEditingUser(user);
    setEditOpen(true);
  }

  function BulkActionsBar({
    count,
    onAddTags,
    onRemoveTags,
    onSendMessage,
    onDelete,
    onClear,
  }) {
    if (count === 0) return null;
    return (
      <div style={styles.quickAction}>
        <strong>{count}</strong> selecionados
        <span aria-hidden>•</span>
        <button onClick={onAddTags} style={styles.quickActionBtn}>
          Adicionar tags
        </button>
        <button onClick={onRemoveTags} style={styles.quickActionBtn}>
          Remover tags
        </button>
        <button onClick={onSendMessage} style={styles.quickActionBtn}>
          Enviar mensagem
        </button>
        <button onClick={onDelete} style={styles.quickActionBtn}>
          Apagar
        </button>
        <button onClick={onDelete} style={styles.quickActionBtn}>
          Limpar
        </button>
      </div>
    );
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

        {/* <button className={styles.iconBtn} title="Filtrar" aria-label="Filtrar">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            fill="none"
          >
            <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" strokeWidth="2" />
          </svg>
        </button> */}

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
        {/* <div className={styles.viewBtns}>
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
        </div> */}
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
            const all = Array.isArray(u.tags) ? u.tags : [];
            const shown = all.slice(0, MAX_TAGS);
            const extra = all.length - shown.length;

            return (
              <div
                key={u.id}
                className={`${styles.row} ${i % 2 ? styles.rowAlt : ""}`}
              >
                {/* checkbox */}
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

                {/* name */}
                <div className={styles.cellName}>
                  <div className={styles.avatar}>{initial(u.name)}</div>
                  <div className={styles.nameBlock}>
                    <div className={styles.name}>{u.name}</div>
                    <div className={styles.subline}>
                      {u.email || u.phone || "—"}
                    </div>
                  </div>
                </div>

                {/* phone */}
                <div className={styles.cellPhone}>{u.phone || "—"}</div>

                {/* tags */}
                <div className={styles.cellTags}>
                  {shown.map((t) => (
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

                {/* assistant */}
                <div className={styles.cellAssistant}>
                  <AssistantPicker
                    value={u.assistantId}
                    assistants={assistantsList}
                    onChange={async (newAssistantId) => {
                      try {
                        const res = await fetch("/api/users", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: u.id,
                            assistantId: newAssistantId,
                          }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          console.error(
                            "Falha ao atualizar assistente:",
                            err.error
                          );
                        } else {
                          await refreshUsers();
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  />
                </div>

                {/* kebab */}
                <div className={styles.cellKebab}>
                  <button
                    className={styles.iconBtn}
                    aria-label="Mais opções"
                    onClick={(e) => openRowMenu(u, e.currentTarget)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GRID (CARD) VIEW — left as-is; list view is the main area you asked about */}

      {/* Menus / Modals */}
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
        assistants={assistantsList}
      />

      {orgId && (
        <ManageTagsModal
          isOpen={isTagsOpen}
          orgId={org.id}
          onClose={() => setIsTagsOpen(false)}
        />
      )}

      <RowActionsMenu
        anchorEl={rowMenu.anchor}
        open={rowMenu.open}
        onClose={closeRowMenu}
        onSendMessage={() => {
          closeRowMenu();
          // TODO: your send-message flow
          alert(`(demo) Enviar mensagem para ${rowMenu.user?.name}`);
        }}
        onEdit={() => {
          const u = rowMenu.user;
          closeRowMenu();
          openEditFor(u);
        }}
        onDelete={async () => {
          const id = rowMenu.user?.id;
          closeRowMenu();
          if (id) await deleteUserById(id);
        }}
      />

      {orgId && (
        <EditUserModal
          open={editOpen}
          user={editingUser}
          orgId={orgId}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            await refreshUsers();
          }}
        />
      )}
    </div>
  );
}
