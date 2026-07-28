/**
 * Templates de WhatsApp da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */

import { COMPANY_KEYS, NAME_KEYS, STATUS_RANK } from "./constants";
/**
 * Ordena templates dando prioridade ao melhor estado disponível.
 *
 * Em caso de empate, dá prioridade ao template atualizado/criado mais recentemente.
 */
export const byBestStatus = (a, b) => {
  const rankA = STATUS_RANK[a.status] || 0;
  const rankB = STATUS_RANK[b.status] || 0;

  if (rankA !== rankB) return rankB - rankA;

  const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();

  return timeB - timeA;
};

/**
 * Substitui variáveis {{key}} por valores reais.
 *
 * Também reconhece keys equivalentes para nome do destinatário
 * e nome da organização.
 */
export function interpolate(str, values) {
  if (!str) return "";

  return str.replace(/\{\{\s*([.\w-]+)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey).toLowerCase();

    if (NAME_KEYS.includes(key)) {
      return values.recipientName ?? values[rawKey] ?? values[key] ?? "";
    }

    if (COMPANY_KEYS.includes(key)) {
      return values.orgName ?? values[rawKey] ?? values[key] ?? "";
    }

    return values[rawKey] ?? values[key] ?? "";
  });
}

/**
 * Extrai textos relevantes de uma estrutura de blocos.
 *
 * Percorre objetos e arrays à procura de campos como text, title e content.
 */
export function extractText(node, out = []) {
  if (!node) return out;

  if (Array.isArray(node)) {
    node.forEach((item) => extractText(item, out));
    return out;
  }

  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (
        typeof value === "string" &&
        (key === "text" || key === "title" || key === "content")
      ) {
        out.push(value);
      } else {
        extractText(value, out);
      }
    }
  }

  return out;
}

/**
 * Verifica se os blocos de um template incluem variável de URL.
 *
 * Isto é necessário para saber se a UI deve obrigar o utilizador
 * a associar um tracked link ao botão URL do template.
 */
export function blocksHaveUrlVariable(blocks) {
  const visit = (node) => {
    if (!node) return false;
    if (Array.isArray(node)) return node.some(visit);

    if (typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (
          key === "url" &&
          typeof value === "string" &&
          value.includes("{{")
        ) {
          return true;
        }

        if (visit(value)) return true;
      }
    }

    return false;
  };

  return visit(blocks);
}

/**
 * Interpreta parâmetros manuais escritos no formato key=value.
 *
 * Os valores são devolvidos pela ordem em que aparecem no texto.
 */
export function parseManualTemplateParams(manualParams) {
  const map = new Map(
    String(manualParams || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...rest] = item.split("=");

        return [key.trim(), rest.join("=").trim()];
      }),
  );

  return Array.from(map.values());
}

/**
 * Organiza os valores dos parâmetros pela ordem esperada pelo template.
 *
 * Aceita valores definidos nos inputs e, quando necessário,
 * parâmetros manuais introduzidos pelo utilizador.
 */
export function getOrderedTemplateParamValues({
  varDefs,
  varValues,
  manualParams,
}) {
  if (!Array.isArray(varDefs) || varDefs.length === 0) {
    return parseManualTemplateParams(manualParams);
  }

  return varDefs.map((variable) =>
    String(varValues?.[variable.key] ?? "").trim(),
  );
}

/**
 * Constrói as variáveis usadas no preview do template.
 *
 * Pode usar dados do destinatário, nome da organização,
 * valores manuais e tracked link escolhido para URL buttons.
 */
export function buildTemplatePreviewVars({
  varDefs,
  varValues,
  sampleRecipient,
  orgName,
  needsUrlVar,
  selectedTrackedUrlKey,
}) {
  const map = {};

  for (const variable of varDefs || []) {
    map[variable.key] = varValues?.[variable.key] ?? "";
  }

  map.recipientName = sampleRecipient?.name || map.name || map.nome || "";
  map.orgName = orgName || map.empresa || map.company || map.organization || "";
  map.urlVar =
    needsUrlVar && selectedTrackedUrlKey
      ? `{{link.${selectedTrackedUrlKey}}}`
      : "";

  return map;
}

/**
 * Gera o preview visual/textual do template WhatsApp.
 *
 * Usa os detalhes do template, o idioma selecionado
 * e as variáveis preparadas para simular a mensagem final.
 */
export function buildTemplatePreview({ tplDetails, tplLang, previewVars }) {
  if (!tplDetails) {
    return {
      body: "",
      buttonText: "",
      buttonUrl: "",
    };
  }

  const platformContent =
    (tplDetails.platformContent || []).find(
      (item) => (item.locale || tplDetails.defaultLocale) === tplLang,
    ) || (tplDetails.platformContent || [])[0];

  const blocks = platformContent?.blocks?.length
    ? platformContent.blocks
    : tplDetails.genericContent?.[0]?.blocks || [];

  const bodyRaw = extractText(blocks).join("\n\n");
  const body = interpolate(bodyRaw, previewVars);

  let buttonText = "";
  let buttonUrl = "";

  function scan(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(scan);
      return;
    }

    if (typeof node !== "object") return;

    if (node.action?.type === "link" && node.action.link) {
      buttonText = node.action.link.text || buttonText;
      buttonUrl = node.action.link.url || buttonUrl;
    }

    for (const value of Object.values(node)) {
      scan(value);
    }
  }

  scan(blocks);

  return {
    body,
    buttonText: interpolate(buttonText, previewVars),
    buttonUrl: interpolate(buttonUrl, {
      ...previewVars,
      urlVar: previewVars.urlVar,
    }),
  };
}

/**
 * Valida se os parâmetros obrigatórios do template estão completos.
 *
 * Impede envio com template selecionado mas variáveis em falta.
 */
export function areTemplateParamsComplete({
  varDefs,
  manualParams,
  orderedParamValues,
}) {
  const hasVariableDefinitions = Array.isArray(varDefs) && varDefs.length > 0;

  if (!hasVariableDefinitions) {
    return String(manualParams || "").trim().length > 0;
  }

  return (orderedParamValues || []).every((value) => value !== "");
}
