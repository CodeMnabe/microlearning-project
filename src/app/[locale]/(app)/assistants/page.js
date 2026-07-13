"use client";

import { useTranslations } from "next-intl";

import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";
import { useAlert } from "@/app/components/Alert/AlertProvider";

import styles from "./assistants.module.css";

import AssistantsList from "./components/AssistantsList";
import AssistantsMainPanel from "./components/AssistantsMainPanel";
import ChatSandbox from "./components/ChatSandbox";
import CreateAssistantModal from "./components/CreateAssistantModal";

import { useAssistantsHub } from "./hooks/assistants.hooks";

/**
 * Página principal da camada Assistants.
 *
 * Responsabilidades:
 * - compor a interface de gestão de assistentes;
 * - apresentar a lista de assistentes da organização atual;
 * - apresentar o detalhe do assistente selecionado;
 * - apresentar gestão da coleção de documentos/vector store;
 * - apresentar o chat de teste do assistente selecionado;
 * - delegar lógica de dados e ações para hooks locais.
 *
 * Esta página não deve:
 * - fazer fetch diretamente;
 * - comunicar diretamente com Supabase;
 * - gerir regras de criação, edição ou remoção;
 * - conter JSX detalhado dos cards internos.
 */

export default function AssistantsHub() {
  const translation = useTranslations();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const { startLoading, stopLoading } = useGlobalLoader();

  const {
    authLoading,
    orgLoading,
    orgId,

    assistants,
    selectedId,
    selected,
    selectAssistant,

    isEditing,
    draft,
    isSaving,
    startEditing,
    cancelEditing,
    handleFieldChange,
    handleSave,
    deleteAssistant,

    vectorStore,
    vsName,
    setVsName,
    vsFiles,
    handleVectorStoreFilesChange,
    handleAddVectorStore,
    deleteVectorStore,

    isModalOpen,
    openCreateModal,
    closeCreateModal,
    createForm,
    isCreating,
    handleCreateFormChange,
    handleCreateAssistant,
  } = useAssistantsHub({
    translation,
    confirm,
    showAlert,
    startLoading,
    stopLoading,
  });

  return (
    <div className={styles.hub}>
      <AssistantsList
        assistants={assistants}
        selectedId={selectedId}
        orgId={orgId}
        translation={translation}
        onSelect={selectAssistant}
        onCreate={openCreateModal}
      />

      <AssistantsMainPanel
        selected={selected}
        draft={draft}
        isEditing={isEditing}
        isSaving={isSaving}
        vectorStore={vectorStore}
        vsName={vsName}
        vsFiles={vsFiles}
        translation={translation}
        onFieldChange={handleFieldChange}
        onSave={handleSave}
        onCancel={cancelEditing}
        onEdit={startEditing}
        onDelete={deleteAssistant}
        onVectorStoreNameChange={setVsName}
        onVectorStoreFilesChange={handleVectorStoreFilesChange}
        onCreateVectorStore={handleAddVectorStore}
        onDeleteVectorStore={deleteVectorStore}
      />

      <section className={styles.chatCol}>
        {selected && !authLoading && !orgLoading && (
          <ChatSandbox assistant={selected} />
        )}
      </section>

      <CreateAssistantModal
        isOpen={isModalOpen}
        form={createForm}
        isCreating={isCreating}
        translation={translation}
        onClose={closeCreateModal}
        onChange={handleCreateFormChange}
        onSubmit={handleCreateAssistant}
      />
    </div>
  );
}