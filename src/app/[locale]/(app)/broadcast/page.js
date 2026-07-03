"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./broadcast.module.css";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useConfirm } from "@/app/components/Confirm/ConfirmProvider";

import BroadcastHeader from "./components/BroadcastHeader";
import MessageComposer from "./components/MessageComposer";
import AttachmentsPanel from "./components/panels/AttachmentsPanel";
import SchedulePanel from "./components/panels/SchedulePanel";
import TemplatePanel from "./components/panels/TemplatePanel";
import TrackedLinksPanel from "./components/panels/TrackedLinksPanel";
import RecipientsPanel from "./components/recipients/RecipientsPanel";
import ChainMessagesBar from "./components/ChainMessagesBar";
import ChainDelayTools from "./components/ChainDelayTools";




import {
  useBroadcastRecipients,
  useBroadcastSchedule,
  useBroadcastComposer,
  useBroadcastAttachments,
  useBroadcastTrackedLinks,
  useBroadcastChains,
  useBroadcastTemplates,
  useBroadcastBootstrapData,
  useBroadcastChannelGuards,
  useBroadcastDerivedState,
  useBroadcastActions,
  useTrackedPlaceholderInsertion,
  useBroadcastUiState,
} from "./hooks/broadcast.hooks";

/**
 * Página principal da feature Broadcast.
 *
 * Responsabilidades:
 * - obter o utilizador e a organização atual;
 * - coordenar os hooks locais da feature;
 * - controlar opções visuais da página, como canal, modo de entrega e painel ativo;
 * - passar dados e ações para os componentes de UI;
 * - manter a composição da interface num único ponto.
 *
 * A lógica de negócio, validações, payloads, carregamento de dados,
 * anexos, templates, links rastreados e read chains deve ficar nos hooks
 * e helpers locais da feature.
 *
 * Esta page não deve fazer queries diretas à Supabase,
 * nem conter regras longas de envio/agendamento.
 */



export default function BroadcastPage() {
  const { user } = useAuth();
  const { org } = useOrganization(user);

  const translation = useTranslations();
  const showAlert = useAlert();
  const confirm = useConfirm();

  const supabase = useMemo(() => createClient(), []);
  const { stopLoading } = useGlobalLoader();
  const filterBtnRef = useRef(null);
 
  // Estado visual mínimo da página.
// A lógica complexa associada a estes valores fica nos hooks da feature.
  const [channel, setChannel] = useState("teams");
  const [deliveryMode, setDeliveryMode] = useState("now");
  const [activeToolPanel, setActiveToolPanel] = useState(null);


  // Hooks locais da feature Broadcast.
// Cada hook controla uma área funcional específica da página,
// mantendo a page focada apenas na composição da interface.
  const {
  scheduledFor,
  setScheduledFor,

  hourDraft,
  minuteDraft,

  timeError,
  browserTimeZone,
  scheduledDateFromDraft,
  scheduleInvalid,

  commitTimeParts,
  handleHourChange,
  handleMinuteChange,
} = useBroadcastSchedule({ deliveryMode });

  const {
  setUsers,
  q,
  setQ,
  selected,
  allTags,
  setAllTags,
  assistantsList,
  setAssistantsList,
  filterOpen,
  setFilterOpen,
  selectedTagIds,
  setSelectedTagIds,
  selectedAssistantIds,
  setSelectedAssistantIds,
  activeFilterCount,
  selectedUsers,
  filtered,
  allOnPageSelected,
  toggleOne,
  toggleAllCurrent,
} = useBroadcastRecipients({ channel });

 const {
  readChainsFeatureEnabled,
  setReadChainsFeatureEnabled,

  chainMode,
  setChainMode,

  activeChainStepIndex,
  setActiveChainStepIndex,

  chainSteps,
  setChainSteps,

  addChainStep,
  duplicateChainStep,
  removeChainStep,

  updateChainStepDelayPart,

  activeDelay,
  activeDelayParts,
} = useBroadcastChains();

const {
  composerMessage,
  composerFiles,
  composerTrackedLinks,
  composerSelectedTrackedUrlKey,

  setComposerMessage,
  setComposerFiles,
  setComposerTrackedLinks,
  setComposerSelectedTrackedUrlKey,

  setSelectedTrackedUrlKey,
} = useBroadcastComposer({
  chainMode,
  chainSteps,
  setChainSteps,
  activeChainStepIndex,
});

const {
  tplLoading,
  tplErr,

  tplName,
  setTplName,

  tplLang,

  varDefs,
  varValues,
  setVarValues,

  needsUrlVar,

  tplParamsManual,
  setTplParamsManual,

  nameOptions,
  chosenTemplate,

  orderedParamValues,
  sampleRecipient,
  preview,
  paramsComplete,

  loadTemplates,
} = useBroadcastTemplates({
  org,
  channel,
  selectedUsers,
  composerSelectedTrackedUrlKey,
  setSelectedTrackedUrlKey,
  showAlert,
  translation,
  stopLoading,
});

const {
  trackedLinkOptions,
  normalizedTrackedLinks,
  trackedLinksCount,
  trackedLinksValid,
  whatsappUrlBindingValid,
  previewMessageWithTrackedLinks,

  addTrackedLink,
  updateTrackedLink,
  removeTrackedLink,
} = useBroadcastTrackedLinks({
  channel,
  composerMessage,
  composerTrackedLinks,
  setComposerTrackedLinks,
  needsUrlVar,
  composerSelectedTrackedUrlKey,
  setComposerSelectedTrackedUrlKey,
  showAlert,
  translation,
});

const {
  fileInputRef,
  thumbInputRef,

  imageFiles,
  videoFiles,
  otherFiles,
  imageUrls,
  attachmentsCount,

  removeFile,
  handlePickFiles,
  openThumbnailPicker,
  handlePickThumbnail,
  removeThumbnail,
} = useBroadcastAttachments({
  supabase,
  composerFiles,
  setComposerFiles,
  showAlert,
  translation,
});


const {
  hasFallbackTemplate,
  chainValid,
  canSend,
  buildBroadcastPayload,
  buildChainPayload,
} = useBroadcastDerivedState({
  channel,
  orgId: org?.id,
  createdByUserId: user?.id || null,

  selectedCount: selected.size,
  scheduleInvalid,

  chainMode,
  readChainsFeatureEnabled,
  chainSteps,

  tplName,
  tplLang,
  paramsComplete,
  chosenTemplate,
  orderedParamValues,
  varDefs,
  tplParamsManual,
  needsUrlVar,

  composerMessage,
  composerFiles,
  composerSelectedTrackedUrlKey,

  imageUrls,
  normalizedTrackedLinks,
  trackedLinksValid,
  whatsappUrlBindingValid,
});

const { sending, handleSend, handleSchedule } = useBroadcastActions({
  orgId: org?.id,
  createdByUserId: user?.id || null,

  channel,
  selectedUsers,

  chainMode,
  readChainsFeatureEnabled,
  hasFallbackTemplate,
  chainValid,

  trackedLinksValid,
  whatsappUrlBindingValid,

  tplName,
  tplLang,
  paramsComplete,

  composerMessage,
  composerFiles,

  buildBroadcastPayload,
  buildChainPayload,

  hourDraft,
  minuteDraft,
  commitTimeParts,
  scheduledDateFromDraft,
  browserTimeZone,

  setDeliveryMode,

  showAlert,
  confirm,
  translation,
});

const { previewTime, scheduleButtonLabel, templateButtonLabel } =
  useBroadcastUiState({
    deliveryMode,
    scheduledFor,
    channel,
    tplName,
    translation,
  });

const { messageInputRef, insertTrackedPlaceholder } =
  useTrackedPlaceholderInsertion({
    composerMessage,
    setComposerMessage,
  });



  useBroadcastBootstrapData({
  orgId: org?.id,
  channel,

  setUsers,
  setAllTags,
  setAssistantsList,
  setReadChainsFeatureEnabled,

  loadTemplates,
  showAlert,
  translation,
  stopLoading,
});

useBroadcastChannelGuards({
  channel,
  activeToolPanel,
  setActiveToolPanel,
  chainMode,
  setChainMode,
});

// Abre ou fecha o painel lateral ativo do composer.
// Se o utilizador clicar no painel já aberto, o painel é fechado.
  function toggleToolPanel(panel) {
    setActiveToolPanel((prev) => (prev === panel ? null : panel));
  }
 
 

  return (
    <div className={styles.screen}>
      <BroadcastHeader
        channel={channel}
        setChannel={setChannel}
        selectedCount={selected.size}
        sending={sending}
        canSend={canSend}
        deliveryMode={deliveryMode}
        onPrimaryClick={
          deliveryMode === "schedule" ? handleSchedule : handleSend
        }
        translation={translation}
      />

      <div className={styles.columns}>
        <div className={styles.leftCol}>
          <MessageComposer
            messageInputRef={messageInputRef}
            message={composerMessage}
            setMessage={setComposerMessage}
            normalizedTrackedLinks={normalizedTrackedLinks}
            previewMessageWithTrackedLinks={previewMessageWithTrackedLinks}
            insertTrackedPlaceholder={insertTrackedPlaceholder}
            activeToolPanel={activeToolPanel}
            toggleToolPanel={toggleToolPanel}
            scheduleButtonLabel={scheduleButtonLabel}
            attachmentsCount={attachmentsCount}
            trackedLinksCount={trackedLinksCount}
            channel={channel}
            templateButtonLabel={templateButtonLabel}
            translation={translation}
            leftToolsContent={
            <ChainDelayTools
              chainMode={chainMode}
              activeChainStepIndex={activeChainStepIndex}
              activeDelay={activeDelay}
              activeDelayParts={activeDelayParts}
              updateChainStepDelayPart={updateChainStepDelayPart}
              translation={translation}
            />
          }
            chainControls={
              channel === "whatsapp" ? (
                <ChainMessagesBar
                  enabled={readChainsFeatureEnabled}
                  chainMode={chainMode}
                  setChainMode={setChainMode}
                  chainSteps={chainSteps}
                  activeChainStepIndex={activeChainStepIndex}
                  setActiveChainStepIndex={setActiveChainStepIndex}
                  addChainStep={addChainStep}
                  duplicateChainStep={duplicateChainStep}
                  removeChainStep={removeChainStep}
                  hasFallbackTemplate={Boolean(hasFallbackTemplate)}
                  translation={translation}
                />
              ) : null
            }
          >
            {activeToolPanel === "schedule" && (
              <SchedulePanel
                deliveryMode={deliveryMode}
                setDeliveryMode={setDeliveryMode}
                scheduledFor={scheduledFor}
                setScheduledFor={setScheduledFor}
                hourDraft={hourDraft}
                minuteDraft={minuteDraft}
                handleHourChange={handleHourChange}
                handleMinuteChange={handleMinuteChange}
                commitTimeParts={commitTimeParts}
                timeError={timeError}
                scheduleInvalid={scheduleInvalid}
                browserTimeZone={browserTimeZone}
                translation={translation}
              />
            )}

            {activeToolPanel === "attachments" && (
              <AttachmentsPanel
                channel={channel}
                fileInputRef={fileInputRef}
                thumbInputRef={thumbInputRef}
                handlePickFiles={handlePickFiles}
                handlePickThumbnail={handlePickThumbnail}
                imageFiles={imageFiles}
                videoFiles={videoFiles}
                otherFiles={otherFiles}
                files={composerFiles}
                removeFile={removeFile}
                openThumbnailPicker={openThumbnailPicker}
                removeThumbnail={removeThumbnail}
                translation={translation}
              />
            )}

            {activeToolPanel === "links" && (
              <TrackedLinksPanel
                channel={channel}
                needsUrlVar={needsUrlVar}
                trackedLinks={composerTrackedLinks}
                trackedLinksValid={trackedLinksValid}
                trackedLinkOptions={trackedLinkOptions}
                selectedTrackedUrlKey={composerSelectedTrackedUrlKey}
                setSelectedTrackedUrlKey={setComposerSelectedTrackedUrlKey}
                whatsappUrlBindingValid={whatsappUrlBindingValid}
                addTrackedLink={addTrackedLink}
                updateTrackedLink={updateTrackedLink}
                removeTrackedLink={removeTrackedLink}
                translation={translation}
              />
            )}

            {activeToolPanel === "template" && channel === "whatsapp" && (
              <TemplatePanel
                tplErr={tplErr}
                tplLoading={tplLoading}
                nameOptions={nameOptions}
                tplName={tplName}
                setTplName={setTplName}
                varDefs={varDefs}
                varValues={varValues}
                setVarValues={setVarValues}
                tplLang={tplLang}
                tplParamsManual={tplParamsManual}
                setTplParamsManual={setTplParamsManual}
                paramsComplete={paramsComplete}
                org={org}
                sampleRecipient={sampleRecipient}
                preview={preview}
                previewTime={previewTime}
                translation={translation}
              />
            )}
          </MessageComposer>
        </div>

        <div className={styles.rightCol}>
          <RecipientsPanel
            filterBtnRef={filterBtnRef}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            activeFilterCount={activeFilterCount}
            allTags={allTags}
            assistantsList={assistantsList}
            selectedTagIds={selectedTagIds}
            setSelectedTagIds={setSelectedTagIds}
            selectedAssistantIds={selectedAssistantIds}
            setSelectedAssistantIds={setSelectedAssistantIds}
            q={q}
            setQ={setQ}
            filtered={filtered}
            selected={selected}
            toggleOne={toggleOne}
            toggleAllCurrent={toggleAllCurrent}
            allOnPageSelected={allOnPageSelected}
            channel={channel}
            translation={translation}
          />
        </div>
      </div>
    </div>
  );
}
