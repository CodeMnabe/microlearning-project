"use client";

import TemplatesFeedback from "./components/TemplatesFeedback";
import TemplatesHeader from "./components/TemplatesHeader";
import TemplatesTable from "./components/TemplatesTable";
import TemplatesTabs from "./components/TemplatesTabs";
import TemplateCreateForm from "./components/TemplateCreateForm";
import TemplateSendTestModal from "./components/TemplateSendTestModal";
import useBroadcastTemplatesAdmin from "./hooks/useBroadcastTemplatesAdmin";
import styles from "./templates.module.css";

/**
 * Página de gestão de templates WhatsApp.
 *
 * Compõe a interface da subfeature Templates e liga os dados do hook aos
 * componentes visuais. A lógica de frontend fica em useBroadcastTemplatesAdmin.
 */
export default function TemplatesPage() {
  const {
    translation,
    view,
    setView,
    loading,
    error,
    notice,
    items,
    form,
    updateFormField,
    changePreset,
    resetPreset,
    refresh,
    createTemplate,
    sendOpen,
    sendTemplate,
    sendTo,
    setSendTo,
    sendParams,
    setSendParams,
    sendUrlVar,
    setSendUrlVar,
    openSendModal,
    closeSendModal,
    sendTest,
  } = useBroadcastTemplatesAdmin();

  return (
    <main className={styles.page}>
      <TemplatesHeader translation={translation} />
      <TemplatesTabs translation={translation} view={view} onChange={setView} />
      <TemplatesFeedback error={error} notice={notice} />

      {view === "list" ? (
        <TemplatesTable
          translation={translation}
          items={items}
          loading={loading}
          onRefresh={refresh}
          onSendTest={openSendModal}
        />
      ) : (
        <TemplateCreateForm
          translation={translation}
          form={form}
          loading={loading}
          onSubmit={createTemplate}
          onFieldChange={updateFormField}
          onPresetChange={changePreset}
          onResetPreset={resetPreset}
        />
      )}

      {sendOpen && (
        <TemplateSendTestModal
          translation={translation}
          template={sendTemplate}
          sendTo={sendTo}
          sendParams={sendParams}
          sendUrlVar={sendUrlVar}
          loading={loading}
          onClose={closeSendModal}
          onSendToChange={setSendTo}
          onSendParamsChange={setSendParams}
          onSendUrlVarChange={setSendUrlVar}
          onSubmit={sendTest}
        />
      )}
    </main>
  );
}
