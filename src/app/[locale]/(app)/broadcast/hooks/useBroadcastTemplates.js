"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { COMPANY_KEYS, NAME_KEYS } from "../lib/constants";
import {
  areTemplateParamsComplete,
  asList,
  blocksHaveUrlVariable,
  buildTemplatePreview,
  buildTemplatePreviewVars,
  byBestStatus,
  getOrderedTemplateParamValues,
} from "../lib";
/**
 * Gere templates WhatsApp disponíveis para a organização.
 *
 * Responsabilidades:
 * - carregar templates aprovados/disponíveis;
 * - escolher automaticamente o melhor template inicial;
 * - carregar detalhes do template selecionado;
 * - preparar variáveis e valores por defeito;
 * - detetar se o template precisa de URL button;
 * - gerar preview do template;
 * - validar se os parâmetros obrigatórios estão completos.
 */

export function useBroadcastTemplates({
  org,
  channel,
  selectedUsers,
  composerSelectedTrackedUrlKey,
  setSelectedTrackedUrlKey,
  showAlert,
  translation,
  stopLoading,
}) {
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState(null);

  const [tplName, setTplName] = useState("");
  const [tplLang, setTplLang] = useState("pt-PT");

  const [tplDetails, setTplDetails] = useState(null);
  const [varDefs, setVarDefs] = useState([]);
  const [varValues, setVarValues] = useState({});
  const [needsUrlVar, setNeedsUrlVar] = useState(false);
  const [tplParamsManual, setTplParamsManual] = useState("");

  const loadTemplates = useCallback(async () => {
    if (!org?.id) return;

    setTplLoading(true);
    setTplErr(null);

    try {
      const res = await fetch(`/api/template/list?orgId=${org.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch templates");
      }

      const items = asList(data, "items").map((template) => ({
        ...template,
        createdAt: template.createdAt || null,
        updatedAt: template.updatedAt || null,
      }));

      setTemplates(items);

      const best = [...items].sort(byBestStatus)[0];

      if (best) {
        setTplName(best.name);
        setTplLang("pt-PT");
      }
    } catch (err) {
      console.warn("[Broadcast] templates load error:", err);

      setTplErr(err.message);

      await showAlert({
        title: translation("Broadcast.alerts.templatesLoadFailed.title"),
        message: translation("Broadcast.alerts.templatesLoadFailed.message"),
        tone: "danger",
      });
    } finally {
      setTplLoading(false);
      stopLoading?.();
    }
  }, [org?.id, showAlert, stopLoading, translation]);

  const templatesByName = useMemo(() => {
    const map = new Map();

    for (const template of templates) {
      if (!map.has(template.name)) {
        map.set(template.name, []);
      }

      map.get(template.name).push(template);
    }

    for (const [key, items] of map) {
      map.set(key, items.sort(byBestStatus));
    }

    return map;
  }, [templates]);

  const nameOptions = useMemo(
    () => Array.from(templatesByName.keys()).sort((a, b) => a.localeCompare(b)),
    [templatesByName],
  );

  const languagesForChosenName = useMemo(
    () => (tplName ? templatesByName.get(tplName) || [] : []),
    [tplName, templatesByName],
  );

  useEffect(() => {
    if (!tplName) return;

    const list = templatesByName.get(tplName) || [];

    const pt = list.find((template) =>
      (template.language || "").toLowerCase().startsWith("pt"),
    );

    setTplLang(pt?.language || list[0]?.language || "pt-PT");
  }, [tplName, templatesByName]);

  const chosenTemplate = useMemo(() => {
    const list = languagesForChosenName;

    return (
      list.find((template) => template.language === tplLang) ||
      list.find((template) =>
        (template.language || "").toLowerCase().startsWith("pt"),
      ) ||
      list[0] ||
      null
    );
  }, [languagesForChosenName, tplLang]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setTplDetails(null);
      setVarDefs([]);
      setVarValues({});
      setNeedsUrlVar(false);
      setSelectedTrackedUrlKey("");

      if (!org?.id || !chosenTemplate || channel !== "whatsapp") return;

      try {
        const res = await fetch(
          `/api/template?orgId=${org.id}&projectId=${chosenTemplate.projectId}&id=${chosenTemplate.id}`,
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch template");
        }

        if (!alive) return;

        setTplDetails(data);

        const defs = Array.isArray(data.variables) ? data.variables : [];
        const defaults = {};

        for (const variable of defs) {
          const examples =
            variable.examplesLocale?.[tplLang]?.exampleValueStrings;

          defaults[variable.key] = examples?.[0] ?? "";
        }

        setVarDefs(defs);
        setVarValues(defaults);

        const blocksForLocale =
          (data.platformContent || []).find(
            (item) => (item.locale || data.defaultLocale) === tplLang,
          ) || (data.platformContent || [])[0];

        setNeedsUrlVar(blocksHaveUrlVariable(blocksForLocale?.blocks || []));
      } catch (err) {
        console.warn("[Broadcast] template details load error:", err);

        if (!alive) return;

        await showAlert({
          title: translation("Broadcast.alerts.templateDetailsFailed.title"),
          message: translation(
            "Broadcast.alerts.templateDetailsFailed.message",
          ),
          tone: "danger",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    org?.id,
    chosenTemplate,
    tplLang,
    channel,
    setSelectedTrackedUrlKey,
    showAlert,
    translation,
  ]);

  const orderedParamValues = useMemo(
    () =>
      getOrderedTemplateParamValues({
        varDefs,
        varValues,
        manualParams: tplParamsManual,
      }),
    [varDefs, varValues, tplParamsManual],
  );

  const sampleRecipient = selectedUsers[0] || null;

  const previewVars = useMemo(
    () =>
      buildTemplatePreviewVars({
        varDefs,
        varValues,
        sampleRecipient,
        orgName: org?.name,
        needsUrlVar,
        selectedTrackedUrlKey: composerSelectedTrackedUrlKey,
      }),
    [
      varDefs,
      varValues,
      sampleRecipient,
      org?.name,
      needsUrlVar,
      composerSelectedTrackedUrlKey,
    ],
  );

  const preview = useMemo(
    () =>
      buildTemplatePreview({
        tplDetails,
        tplLang,
        previewVars,
      }),
    [tplDetails, tplLang, previewVars],
  );

  const paramsComplete = useMemo(
    () =>
      areTemplateParamsComplete({
        varDefs,
        manualParams: tplParamsManual,
        orderedParamValues,
      }),
    [varDefs, tplParamsManual, orderedParamValues],
  );

  useEffect(() => {
    if (varDefs.length === 0) return;

    setVarValues((prev) => {
      const next = { ...prev };
      const recipientName = sampleRecipient?.name || "";

      for (const variable of varDefs) {
        const key = variable.key || "";
        const lowerKey = key.toLowerCase();

        if (!next[key]) {
          if (NAME_KEYS.includes(lowerKey)) {
            next[key] = recipientName;
          }

          if (COMPANY_KEYS.includes(lowerKey)) {
            next[key] = org?.name || "";
          }
        }
      }

      return next;
    });
  }, [varDefs, sampleRecipient?.name, org?.name]);

  return {
    templates,
    setTemplates,

    tplLoading,
    setTplLoading,

    tplErr,
    setTplErr,

    tplName,
    setTplName,

    tplLang,
    setTplLang,

    tplDetails,
    setTplDetails,

    varDefs,
    setVarDefs,

    varValues,
    setVarValues,

    needsUrlVar,
    setNeedsUrlVar,

    tplParamsManual,
    setTplParamsManual,

    templatesByName,
    nameOptions,
    languagesForChosenName,
    chosenTemplate,

    orderedParamValues,
    sampleRecipient,
    previewVars,
    preview,
    paramsComplete,

    loadTemplates,
  };
}
