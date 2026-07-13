"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import {
  buildCreateTemplatePayload,
  buildSendTemplateTestPayload,
  createInitialTemplateForm,
  formatTemplateComponents,
  getTemplatePreset,
  parseTemplateComponents,
  readJsonResponse,
} from "../helpers/templates.helpers";

/**
 * Hook principal da subcamada Broadcast Templates.
 *
 * Coordena a sincronização, criação e envio de testes, bem como os estados
 * de interface da página. Não renderiza JSX nem contém estilos visuais.
 */
export default function useBroadcastTemplatesAdmin() {
  const translation = useTranslations("Templates");
  const showAlert = useAlert();
  const { user } = useAuth();
  const { org } = useOrganization(user);
  const { startLoading, stopLoading } = useGlobalLoader();

  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(createInitialTemplateForm);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendTemplate, setSendTemplate] = useState(null);
  const [sendParams, setSendParams] = useState("");
  const [sendUrlVar, setSendUrlVar] = useState("");

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const refresh = useCallback(
    async (showSuccessAlert = false) => {
      if (!org?.id) {
        if (showSuccessAlert) {
          await showAlert({
            title: translation("alerts.noOrg.title"),
            message: translation("alerts.noOrg.message"),
            tone: "warning",
          });
        }
        return;
      }

      clearMessages();
      setLoading(true);
      startLoading();

      try {
        const response = await fetch(`/api/template/list?orgId=${org.id}`);
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.error ? JSON.stringify(data.error) : `HTTP ${data.status}`
          );
        }

        const nextItems = data.items || [];
        const count = nextItems.length;
        setItems(nextItems);
        setNotice(translation("notices.synced", { count }));

        if (showSuccessAlert) {
          await showAlert({
            title: translation("alerts.syncSuccess.title"),
            message: translation("alerts.syncSuccess.message", { count }),
            tone: "success",
          });
        }
      } catch (requestError) {
        setError(translation("errors.fetch", { message: requestError.message }));
        await showAlert({
          title: translation("alerts.syncFailed.title"),
          message: translation("alerts.syncFailed.message"),
          tone: "danger",
        });
      } finally {
        setLoading(false);
        stopLoading();
      }
    },
    [clearMessages, org?.id, showAlert, startLoading, stopLoading, translation]
  );

  useEffect(() => {
    if (org?.id) {
      void refresh();
    }
  }, [org?.id, refresh]);

  const updateFormField = useCallback((field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }, []);

  const changePreset = useCallback((presetKey) => {
    setForm((currentForm) => ({
      ...currentForm,
      presetKey,
      componentsText: formatTemplateComponents(getTemplatePreset(presetKey)),
    }));
  }, []);

  const resetPreset = useCallback(() => {
    setForm((currentForm) => ({
      ...currentForm,
      componentsText: formatTemplateComponents(
        getTemplatePreset(currentForm.presetKey)
      ),
    }));
  }, []);

  const createTemplate = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!org?.id) return;

      clearMessages();

      let components;
      try {
        components = parseTemplateComponents(form.componentsText);
      } catch (parseError) {
        if (parseError instanceof TypeError) {
          setError(translation("errors.componentsArray"));
          await showAlert({
            title: translation("alerts.componentsNotArray.title"),
            message: translation("alerts.componentsNotArray.message"),
            tone: "warning",
          });
          return;
        }

        setError(
          translation("errors.invalidComponents", { message: parseError.message })
        );
        await showAlert({
          title: translation("alerts.invalidJson.title"),
          message: translation("alerts.invalidJson.message"),
          tone: "warning",
        });
        return;
      }

      if (!form.name.trim()) {
        setError(translation("errors.nameRequired"));
        await showAlert({
          title: translation("alerts.nameRequired.title"),
          message: translation("alerts.nameRequired.message"),
          tone: "warning",
        });
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/template/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildCreateTemplatePayload({ orgId: org.id, form, components })
          ),
        });
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.error ? JSON.stringify(data.error) : `HTTP ${data.status}`
          );
        }

        const status = data.template?.status || "NEW";
        setNotice(translation("notices.submitted", { name: form.name, status }));
        await showAlert({
          title: translation("alerts.templateSubmitted.title"),
          message: translation("alerts.templateSubmitted.message", {
            name: form.name,
            status,
          }),
          tone: "success",
        });
        setView("list");
        await refresh();
      } catch (requestError) {
        setError(
          translation("errors.createFailed", { message: requestError.message })
        );
        await showAlert({
          title: translation("alerts.createFailed.title"),
          message: translation("alerts.createFailed.message"),
          tone: "danger",
        });
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, form, org?.id, refresh, showAlert, translation]
  );

  const openSendModal = useCallback((template) => {
    setSendOpen(true);
    setSendTemplate(template);
    setSendTo("");
    setSendParams("");
    setSendUrlVar("");
  }, []);

  const closeSendModal = useCallback(() => setSendOpen(false), []);

  const sendTest = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!org?.id || !sendTemplate) return;

      if (!sendTo.trim()) {
        await showAlert({
          title: translation("alerts.recipientRequired.title"),
          message: translation("alerts.recipientRequired.message"),
          tone: "warning",
        });
        return;
      }

      clearMessages();
      setLoading(true);
      try {
        const response = await fetch("/api/whatsapp/send-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildSendTemplateTestPayload({
              orgId: org.id,
              sendTo,
              sendTemplate,
              sendParams,
              sendUrlVar,
            })
          ),
        });
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.data ? JSON.stringify(data.data) : `HTTP ${data.status}`
          );
        }

        setNotice(translation("notices.sent"));
        closeSendModal();
        await showAlert({
          title: translation("alerts.testSent.title"),
          message: translation("alerts.testSent.message"),
          tone: "success",
        });
      } catch (requestError) {
        setError(
          translation("errors.sendFailed", { message: requestError.message })
        );
        await showAlert({
          title: translation("alerts.testSendFailed.title"),
          message: translation("alerts.testSendFailed.message"),
          tone: "danger",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      clearMessages,
      closeSendModal,
      org?.id,
      sendParams,
      sendTemplate,
      sendTo,
      sendUrlVar,
      showAlert,
      translation,
    ]
  );

  return {
    translation,
    org,
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
  };
}
