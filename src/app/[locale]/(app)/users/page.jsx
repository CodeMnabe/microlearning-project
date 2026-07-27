"use client";

import { useRef, useState } from "react";

import styles from "./users.module.css";

import CreateUserModal from "./components/CreateUserModal";
import EditUserModal from "./components/EditUserModal";
import FilterMenu from "./components/FilterMenu";
import ImportUsersModal from "./components/ImportUsersModal/ImportUsersModal";
import ManageTagsModal from "./components/ManageTagsModal/ManageTagsModal";
import QuickActionsBar from "./components/QuickActions/QuickActions";
import UsersActiveFilters from "./components/UsersActiveFilters";
import UsersTable from "./components/UsersTable";
import UsersToolbar from "./components/UsersToolbar";
import ViewUserModal from "./components/ViewUserModal";

import { useUsers } from "./hooks/users.hooks";

/**
 * Página principal da camada Users.
 *
 * Responsável apenas por:
 * - chamar o hook principal;
 * - compor a interface;
 * - passar dados e callbacks aos componentes;
 * - ancorar o popover de filtros ao respetivo botão.
 *
 * Não deve:
 * - fazer fetches;
 * - gerir regras de negócio;
 * - conter helpers;
 * - conter lógica extensa de estado;
 * - conter JSX detalhado da tabela, da barra de ferramentas ou dos modais.
 */
export default function UsersPage() {
  const users = useUsers();

  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef(null);

  return (
    <div className={styles.usersScreen}>
      <UsersToolbar
        query={users.query}
        onQueryChange={users.setQuery}
        filterButtonRef={filterButtonRef}
        activeFilterCount={users.activeFilterCount}
        onToggleFilters={() => setFilterOpen((v) => !v)}
        onManageTags={() => users.setIsTagsOpen(true)}
        onCreateUser={users.openCreateModal}
        onImportUsers={() => users.setIsImportOpen(true)}
      />

      {users.selectedCount > 0 && (
        <QuickActionsBar
          count={users.selectedCount}
          assistants={users.assistantsList}
          tags={users.allTags}
          selectedIds={users.selectedIds}
          orgId={users.orgId}
          onDone={users.refreshUsers}
          clearSelection={users.clearSelection}
        />
      )}

      <UsersActiveFilters
        tags={users.allTags}
        assistants={users.assistantsList}
        selectedTagIds={users.selectedTagIds}
        selectedAssistantIds={users.selectedAssistantIds}
        onRemoveTag={users.removeTagFilter}
        onRemoveAssistant={users.removeAssistantFilter}
        onClearAll={users.clearFilters}
      />

      {users.view === "list" && (
        <UsersTable
          users={users.visibleUsers}
          assistants={users.assistantsList}
          selected={users.selected}
          allChecked={users.allChecked}
          onToggleAll={users.toggleAll}
          onToggleOne={users.toggleOne}
          onView={users.openViewModal}
          onEdit={users.openEditModal}
          onDelete={users.deleteUserById}
          onAssistantChange={users.handleUserAssistantChange}
          page={users.page}
          pageSize={users.pageSize}
          totalPages={users.totalPages}
          totalUsers={users.totalUsers}
          onPageSizeChange={users.changePageSize}
          onPreviousPage={users.goToPreviousPage}
          onNextPage={users.goToNextPage}
        />
      )}

      <FilterMenu
        open={filterOpen}
        anchorEl={filterButtonRef.current}
        tags={users.allTags}
        assistants={users.assistantsList}
        selectedTagIds={users.selectedTagIds}
        setSelectedTagIds={users.setSelectedTagIds}
        selectedAssistantIds={users.selectedAssistantIds}
        setSelectedAssistantIds={users.setSelectedAssistantIds}
        onClose={() => setFilterOpen(false)}
        onClear={users.clearFilters}
      />

      <CreateUserModal
        isOpen={users.isCreateOpen}
        onClose={() => users.setIsCreateOpen(false)}
        onCreateUser={users.handleCreateUser}
        assistants={users.assistantsList}
        defaultPhoneCode={users.defaultPhoneCode}
      />

      <ImportUsersModal
        isOpen={users.isImportOpen}
        onClose={() => users.setIsImportOpen(false)}
        orgId={users.orgId}
        assistants={users.assistantsList}
        defaultPhoneCode={users.defaultPhoneCode}
        onImported={users.handleImported}
      />

      {users.orgId && (
        <ManageTagsModal
          isOpen={users.isTagsOpen}
          orgId={users.orgId}
          tags={users.allTags}
          setTags={users.setAllTags}
          onClose={() => users.setIsTagsOpen(false)}
        />
      )}

      {users.orgId && (
        <EditUserModal
          open={users.editOpen}
          user={users.editingUser}
          orgId={users.orgId}
          assistants={users.assistantsList}
          onDelete={users.deleteUserById}
          onClose={() => users.setEditOpen(false)}
          onSaved={users.handleUserSaved}
          defaultPhoneCode={users.defaultPhoneCode}
        />
      )}

      {users.orgId && (
        <ViewUserModal
          open={users.viewOpen}
          onClose={() => users.setViewOpen(false)}
          user={users.viewingUser}
          orgId={users.orgId}
          onEdit={users.editFromView}
          assistantsById={users.assistantsById}
        />
      )}
    </div>
  );
}
