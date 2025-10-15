// src/app/(app)/users/page.js
"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import styles from "./users.module.css";
import CreateUserModal from "./CreateUser";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import ManageTagsModal from "./ManageTagsModal/ManageTagsModal";
import EditUserModal from "./EditUserModal";
import PillSelect from "@/app/components/PillSelect/PillSelect";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Tag,
  Filter,
} from "lucide-react";
import useOrganization from "@/app/hooks/useOrganization";
import { useAuth } from "@/app/AuthContext";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import FilterMenu from "./FilterMenu";

function initial(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);

  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [assistantsList, setAssistantsList] = useState([]);

  // filters
  const [allTags, setAllTags] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedAssistantIds, setSelectedAssistantIds] = useState([]);

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const confirm = useConfirm();

  // how many tags to show before "+n"
  const MAX_TAGS = 6;

  // list | grid (persisted)
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "list";
    return localStorage.getItem("usersView") || "list";
  });

  const { stopLoading } = useGlobalLoader();
  useEffect(() => {
    localStorage.setItem("usersView", view);
  }, [view]);

  const orgId = org?.id;

  // assistants
  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;
    (async () => {
      const res = await fetch(`/api/assistants?orgId=${orgId}`);
      const data = await res.json();
      setAssistantsList(data || []);
    })().catch(console.error);
  }, [authLoading, orgLoading, orgId, users]);

  // tags for filter
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const r = await fetch(`/api/tags?orgId=${orgId}`);
        const data = await r.json();
        setAllTags(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setAllTags([]);
      }
    })();
  }, [orgId]);

  const refreshUsers = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(`/api/users?orgId=${orgId}`);
    const data = await res.json();
    setUsers(data);
  }, [orgId]);

  useEffect(() => {
    if (authLoading || orgLoading || !orgId) return;
    refreshUsers().finally(stopLoading);
  }, [authLoading, orgLoading, orgId, refreshUsers, stopLoading]);

  const normalized = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone_number ?? u.phoneNumber ?? "",
        email: u.email ?? "",
        tags: u.tag_names ?? (u.tags || []).map((t) => t.name) ?? [],
        tagIds: u.tag_ids ?? (u.tags || []).map((t) => t.id) ?? [],
        assistantId: u.assistant_id ?? null,
        assistantName: u.assistantName ?? "—",
        organization_id: u.organization_id,
      })),
    [users]
  );

  // Apply text + Tag + Assistant filters
  const visible = useMemo(() => {
    return normalized.filter((u) => {
      const textOk = (u.name + " " + u.phone + " " + u.email)
        .toLowerCase()
        .includes(q.toLowerCase());

      const tagsOk =
        selectedTagIds.length === 0 ||
        // ALL-of logic; switch to .some() for ANY-of
        selectedTagIds.every((id) => (u.tagIds || []).includes(id));

      const assistantOk =
        selectedAssistantIds.length === 0 ||
        selectedAssistantIds.includes(u.assistantId);

      return textOk && tagsOk && assistantOk;
    });
  }, [normalized, q, selectedTagIds, selectedAssistantIds]);

  // selection helpers
  const allVisibleIds = visible.map((u) => u.id);
  const allChecked =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) allVisibleIds.forEach((id) => next.delete(id));
      else allVisibleIds.forEach((id) => next.add(id));
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

  async function handleCreateUser({
    userName,
    phoneNumber,
    email,
    assistantId,
  }) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: org.id,
        phoneNumber,
        name: userName,
        email: email || null,
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
  }

  function openEditFor(u) {
    setEditingUser(u);
    setEditOpen(true);
  }
  function openViewFor(u) {
    alert(`(demo) Ver utilizador: ${u.name}`);
  }

  async function deleteUserById(id) {
    const ok = await confirm({
      title: "Eliminar este utilizador",
      message: "Esta ação não pode ser desfeita.",
      confirmText: "Apagar",
      cancelText: "Cancelar",
      tone: "danger",
    });
    if (!ok) return;

    const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      console.error(await res.text());
      return;
    }
    await refreshUsers();
  }

  const activeFilterCount = selectedTagIds.length + selectedAssistantIds.length;

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
        <button
          type="button"
          ref={filterBtnRef}
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={() => setFilterOpen((v) => !v)}
          title="Filtrar"
        >
          <Filter size={16} /> <span>Filtrar</span>
          {activeFilterCount > 0 && (
            <span className={styles.filterBadge}>{activeFilterCount}</span>
          )}
        </button>

        {/* Right-side actions */}
        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
            onClick={() => setIsTagsOpen(true)}
            title="Gerir tags"
          >
            <Tag size={16} /> <span>Gerir Tags</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => setIsCreateOpen(true)}
            title="Novo utilizador"
          >
            <Plus size={16} /> <span>Novo Utilizador</span>
          </button>
        </div>
      </div>

      {/* Active filter chips */}
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
                  setSelectedTagIds((prev) => prev.filter((x) => x !== id))
                }
                title="Remover filtro"
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
                    prev.filter((x) => x !== id)
                  )
                }
                title="Remover filtro"
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
            Limpar tudo
          </button>
        </div>
      )}

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
                    <div className={styles.subline}>{u.email || ""}</div>
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
                  <PillSelect
                    value={u.assistantId}
                    options={assistantsList.map((a) => ({
                      value: a.id,
                      label: a.name,
                    }))}
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

                {/* tail actions */}
                <div className={styles.cellKebab}>
                  <button
                    className={`${styles.iconBtn} ${styles.kebabDefault}`}
                    aria-label="Mais opções"
                    onClick={() => openEditFor(u)}
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  <div className={styles.rowActions} aria-label="Ações">
                    <button
                      className={styles.rowActBtn}
                      onClick={() => openViewFor(u)}
                      title="Ver"
                    >
                      <Eye size={16} /> <span>Ver</span>
                    </button>
                    <button
                      className={styles.rowActBtn}
                      onClick={() => openEditFor(u)}
                      title="Editar"
                    >
                      <Pencil size={16} /> <span>Editar</span>
                    </button>
                    <button
                      className={`${styles.rowActBtn} ${styles.rowActBtnDanger}`}
                      onClick={() => deleteUserById(u.id)}
                      title="Apagar"
                    >
                      <Trash2 size={16} /> <span>Apagar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Popover filter */}
      <FilterMenu
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
        }}
      />

      {/* Modals */}
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

      {orgId && (
        <EditUserModal
          open={editOpen}
          user={editingUser}
          orgId={orgId}
          assistants={assistantsList}
          onDelete={deleteUserById}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            await refreshUsers();
          }}
        />
      )}
    </div>
  );
}
