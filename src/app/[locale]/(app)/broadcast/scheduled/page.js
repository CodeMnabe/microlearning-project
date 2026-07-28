"use client";

import styles from "./scheduled.module.css";

import { canDeleteItem, canEditItem } from "./lib/scheduled.helpers";

import ScheduledHeader from "./components/ScheduledHeader";
import ScheduledStats from "./components/ScheduledStats";
import ScheduledFilters from "./components/ScheduledFilters";
import ScheduledTable from "./components/ScheduledTable";
import ScheduledViewModal from "./components/ScheduledViewModal";
import ScheduledEditModal from "./components/ScheduledEditModal";

import { useScheduledBroadcasts } from "./hooks/scheduled.hooks";

/**
 * Página de gestão de broadcasts agendados.
 *
 * Responsável apenas por:
 * - chamar o hook principal;
 * - compor a interface;
 * - passar dados e callbacks aos componentes.
 *
 * Não deve:
 * - fazer fetches;
 * - gerir regras de negócio;
 * - conter helpers;
 * - conter lógica extensa de estado.
 */
export default function ScheduledPage() {
  const scheduled = useScheduledBroadcasts();
  const t = scheduled.translation;

  return (
    <div className={styles.scheduledScreen}>
      <ScheduledHeader translation={t} organizationName={scheduled.org?.name} />

      <ScheduledStats translation={t} stats={scheduled.stats} />

      <ScheduledFilters
        translation={t}
        search={scheduled.search}
        onSearchChange={scheduled.setSearch}
        channelFilter={scheduled.channelFilter}
        channelOptions={scheduled.channelOptions}
        onChannelChange={scheduled.setChannelFilter}
        statusFilter={scheduled.statusFilter}
        statusOptions={scheduled.statusOptions}
        onStatusChange={scheduled.setStatusFilter}
        dateFilter={scheduled.dateFilter}
        onDateChange={scheduled.setDateFilter}
        onClearDate={() => scheduled.setDateFilter("")}
        onRefresh={() => scheduled.loadItems(true)}
      />

      {scheduled.error ? (
        <div className={styles.errorBox}>{scheduled.error}</div>
      ) : null}

      <ScheduledTable
        loading={scheduled.loading}
        translation={t}
        filteredItems={scheduled.filteredItems}
        openViewModal={scheduled.openViewModal}
        openEditModal={scheduled.openEditModal}
        canEditItem={canEditItem}
        handleDelete={scheduled.handleDelete}
        canDeleteItem={canDeleteItem}
        deletingId={scheduled.deletingId}
      />

      {scheduled.selectedItem ? (
        <ScheduledViewModal
          selectedItem={scheduled.selectedItem}
          orgUsers={scheduled.orgUsers}
          translation={t}
          isViewModalOpen={scheduled.isViewModalOpen}
          closeViewModal={scheduled.closeViewModal}
          canEditItem={canEditItem}
          openEditModal={scheduled.openEditModal}
          canDeleteItem={canDeleteItem}
          handleDelete={scheduled.handleDelete}
        />
      ) : null}

      {scheduled.editingItem ? (
        <ScheduledEditModal
          item={scheduled.editingItem}
          orgUsers={scheduled.orgUsers}
          usersLoading={scheduled.usersLoading}
          translation={t}
          isEditModalOpen={scheduled.isEditModalOpen}
          closeEditModal={scheduled.closeEditModal}
          onSave={scheduled.handleSaveEdit}
          saving={scheduled.saving}
        />
      ) : null}
    </div>
  );
}
