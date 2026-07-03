
import { COMPANY_KEYS, NAME_KEYS, STATUS_RANK } from "./constants";

/**
 * Helpers locais da feature Broadcast.
 *
 * Este ficheiro contém funções puras e reutilizáveis usadas pela página,
 * hooks e componentes da feature.
 *
 * Responsabilidades:
 * - normalizar utilizadores e destinatários;
 * - filtrar listas para seleção de recipients;
 * - validar datas e horários de agendamento;
 * - preparar anexos para upload e envio;
 * - gerir placeholders e links rastreados;
 * - validar read chains de WhatsApp;
 * - preparar variáveis e previews de templates;
 * - construir payloads enviados para as APIs;
 * - normalizar respostas de envio para feedback na UI.
 *
 * Este ficheiro não deve conter estado React, hooks, JSX,
 * chamadas diretas a providers de UI ou lógica visual.
 */

// ==============================
// Base helpers
// ==============================

/**
 * Obtém a inicial de um nome para uso visual na UI.
 *
 * Quando o nome está vazio, devolve "?" como fallback.
 */
export function getInitial(name = "") {
  return (name?.trim()?.[0] || "?").toUpperCase();
}

/**
 * Cria um identificador único para drafts locais.
 *
 * Usa crypto.randomUUID quando disponível e faz fallback
 * para timestamp + valor aleatório.
 */
export function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Garante que uma resposta é tratada como lista.
 *
 * Algumas APIs podem devolver arrays diretamente ou dentro de uma key,
 * como `items`. Este helper normaliza esses formatos para simplificar
 * o consumo nos hooks.
 */
export function asList(data, preferredKey = "items") {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[preferredKey])) return data[preferredKey];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.users)) return data.users;

  return [];
}

/**
 * Limita um valor numérico entre um mínimo e um máximo.
 *
 * Usado principalmente em inputs de tempo para evitar valores inválidos.
 */
export function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(Math.max(Math.floor(number), min), max);
}

// ==============================
// Recipients helpers
// ==============================

/**
 * Gera uma label humana para a quantidade de destinatários.
 *
 * Usado em confirmações antes de enviar ou agendar.
 */
export function getRecipientLabel(count, translation) {
  return count === 1
    ? `1 ${translation("Broadcast.recipient")}`
    : `${count} ${translation("Broadcast.smallRecipients")}`;
}

/**
 * Converte o canal interno numa label legível.
 *
 * Exemplo: `teams` para `Teams`, `whatsapp` para `WhatsApp`.
 */
export function getChannelLabel(channel) {
  return channel === "whatsapp" ? "WhatsApp" : "Teams";
}

/**
 * Devolve a melhor linha secundária para contactos WhatsApp.
 *
 * A UI usa esta informação para mostrar telefone, username,
 * BSUID ou Bird contact ID conforme o dado disponível.
 */
export function getWhatsappSubline(user) {
  return (
    user.phone_number ||
    (user.whatsapp_username ? `@${user.whatsapp_username}` : "") ||
    user.whatsapp_bsuid ||
    user.bird_contact_id ||
    ""
  );
}

/**
 * Normaliza utilizadores para o formato usado pelo Broadcast.
 *
 * A UI precisa de uma estrutura consistente independentemente do formato
 * original vindo da API. Aqui são preparados campos como id, nome,
 * telefone, email, tags, assistente e dados específicos de WhatsApp.
 */
export function normalizeBroadcastUsers(users) {
  return (users || []).map((user) => ({
    ...user,
    id: user.id,
    name: user.name,
    phone_number: user.phone_number ?? user.phoneNumber ?? "",
    whatsapp_bsuid: user.whatsapp_bsuid ?? user.whatsappBsuid ?? "",
    whatsapp_username: user.whatsapp_username ?? user.whatsappUsername ?? "",
    bird_contact_id: user.bird_contact_id ?? user.birdContactId ?? "",
    email: user.email ?? "",
    tagIds: user.tag_ids ?? (user.tags || []).map((tag) => tag.id),
    assistantId: user.assistant_id ?? null,
  }));
}

/**
 * Aplica pesquisa e filtros à lista de destinatários.
 *
 * Considera:
 * - texto pesquisado;
 * - tags selecionadas;
 * - assistentes selecionados;
 * - canal atual, porque Teams e WhatsApp podem exigir dados diferentes.
 */
export function filterBroadcastUsers({
  users,
  query,
  selectedTagIds,
  selectedAssistantIds,
  channel,
}) {
  const term = String(query || "")
    .trim()
    .toLowerCase();

  return (users || []).filter((user) => {
    const textHay = `${user.name || ""} ${user.phone_number || ""} ${
      user.whatsapp_username || ""
    } ${user.whatsapp_bsuid || ""} ${user.email || ""}`.toLowerCase();

    const textOk = !term || textHay.includes(term);

    const tagsOk =
      selectedTagIds.length === 0 ||
      selectedTagIds.every((id) => (user.tagIds || []).includes(id));

    const assistantOk =
      selectedAssistantIds.length === 0 ||
      selectedAssistantIds.includes(user.assistantId);

    const channelOk =
      channel !== "whatsapp" ||
      Boolean(user.phone_number || user.whatsapp_bsuid || user.bird_contact_id);

    return channelOk && textOk && tagsOk && assistantOk;
  });
}

// ==============================
// Schedule helpers
// ==============================

/**
 * Cria a data inicial sugerida para agendamento.
 *
 * A data é arredondada para o próximo bloco de 5 minutos
 * e empurrada alguns minutos para o futuro para evitar valores já expirados.
 */
export function buildInitialScheduledDate() {
  const date = new Date();

  date.setMinutes(date.getMinutes() + 5);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);

  return date;
}

/**
 * Formata a hora de uma data para o input de hora.
 *
 * Devolve sempre dois dígitos para manter o input previsível.
 */
export function formatHour(date) {
  return String(date.getHours()).padStart(2, "0");
}

/**
 * Formata os minutos de uma data para o input de minutos.
 *
 * Devolve sempre dois dígitos para evitar inconsistências na UI.
 */
export function formatMinute(date) {
  return String(date.getMinutes()).padStart(2, "0");
}

/**
 * Limpa o valor introduzido nos campos de hora/minuto.
 *
 * Remove caracteres inválidos e mantém apenas o necessário
 * para validar o horário.
 */
export function cleanTimeDraft(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 2);
}

/**
 * Valida hora e minuto antes de aplicar ao agendamento.
 *
 * Esta função concentra as regras de horário permitido.
 * Deve devolver um resultado previsível para o hook mostrar erro
 * ou aceitar o valor.
 */
export function validateScheduleTimeParts(hourValue, minuteValue) {
  const rawHour = String(hourValue || "").trim();
  const rawMinute = String(minuteValue || "").trim();

  if (!rawHour || !rawMinute) {
    return {
      ok: false,
      error: "Fill in both hour and minute.",
    };
  }

  if (!/^\d{1,2}$/.test(rawHour) || !/^\d{1,2}$/.test(rawMinute)) {
    return {
      ok: false,
      error: "Use only numbers.",
    };
  }

  const hours = Number(rawHour);
  const minutes = Number(rawMinute);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return {
      ok: false,
      error: "Enter a valid time.",
    };
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return {
      ok: false,
      error: "Enter a valid time.",
    };
  }

  const totalMinutes = hours * 60 + minutes;
  const minMinutes = 8 * 60;
  const maxMinutes = 20 * 60;

  if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
    return {
      ok: false,
      error: "Choose a time between 08:00 and 20:00.",
    };
  }

  return {
    ok: true,
    error: "",
    hours,
    minutes,
  };
}

/**
 * Aplica hora e minuto a uma data já escolhida.
 *
 * Mantém o dia selecionado pelo utilizador e atualiza apenas
 * a parte horária.
 */
export function applyTimeToDate(dateValue, hours, minutes) {
  const next = new Date(dateValue);

  next.setHours(hours, minutes, 0, 0);

  return next;
}

/**
 * Valida se um valor pode ser tratado como data.
 */
export function isValidDate(dateValue) {
  const date = new Date(dateValue);

  return !Number.isNaN(date.getTime());
}

/**
 * Verifica se uma data está no futuro.
 *
 * Usado para impedir agendamentos com datas passadas.
 */
export function isFutureDate(dateValue, now = Date.now()) {
  const date = new Date(dateValue);

  return isValidDate(date) && date.getTime() > now;
}

/**
 * Constrói uma data final a partir da data selecionada
 * e dos drafts de hora/minuto.
 *
 * Se os drafts forem inválidos, devolve null para impedir
 * o agendamento.
 */
export function getScheduledDateFromDraft(dateValue, hourValue, minuteValue) {
  if (!isValidDate(dateValue)) {
    return null;
  }

  const validation = validateScheduleTimeParts(hourValue, minuteValue);

  if (!validation.ok) {
    return null;
  }

  return applyTimeToDate(dateValue, validation.hours, validation.minutes);
}

// ==============================
// Attachment / Upload helpers
// ==============================

/**
 * Verifica se um content type representa uma imagem.
 *
 * Usado para separar anexos por tipo e preparar previews/payloads.
 */
export function isImageContentType(contentType = "") {
  return String(contentType).toLowerCase().startsWith("image/");
}

/**
 * Verifica se um content type representa um vídeo.
 *
 * Usado para permitir tratamento específico, como thumbnails.
 */
export function isVideoContentType(contentType = "") {
  return String(contentType).toLowerCase().startsWith("video/");
}

/**
 * Tenta inferir o content type a partir do nome do ficheiro.
 *
 * Usado como fallback quando o browser não fornece `file.type`.
 */
export function guessContentTypeFromName(name = "") {
  const normalizedName = String(name || "").toLowerCase();

  if (normalizedName.endsWith(".png")) return "image/png";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedName.endsWith(".gif")) return "image/gif";
  if (normalizedName.endsWith(".webp")) return "image/webp";
  if (normalizedName.endsWith(".pdf")) return "application/pdf";
  if (normalizedName.endsWith(".mp4")) return "video/mp4";
  if (normalizedName.endsWith(".mov")) return "video/quicktime";
  if (normalizedName.endsWith(".webm")) return "video/webm";

  return "application/octet-stream";
}

/**
 * Converte o nome de um ficheiro num formato seguro para storage.
 *
 * Remove acentos e substitui caracteres problemáticos por underscores.
 */
export function makeSafeFileName(name) {
  let safe = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!safe) safe = "file";

  return safe;
}

/**
 * Cria a key usada no storage para ficheiros de Broadcast.
 *
 * Inclui timestamp e valor aleatório para reduzir colisões.
 */
export function makeBroadcastStorageKey(fileName) {
  const safeName = makeSafeFileName(fileName);

  return `broadcasts/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${safeName}`;
}

/**
 * Faz upload de ficheiros do Broadcast para o storage.
 *
 * Esta função devolve objetos normalizados com os dados necessários
 * para envio, como url, nome e contentType.
 */
export async function uploadBroadcastFiles({
  supabase,
  files,
  bucket = "images",
}) {
  const uploaded = [];

  for (const file of files || []) {
    const key = makeBroadcastStorageKey(file.name);
    const contentType = file.type || guessContentTypeFromName(file.name);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(key, file, {
        upsert: true,
        contentType,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(key);

    if (publicData?.publicUrl) {
      uploaded.push({
        url: publicData.publicUrl,
        name: file.name || makeSafeFileName(file.name),
        contentType: contentType || "application/octet-stream",
      });
    }
  }

  return uploaded;
}

// ==============================
// Tracked link helpers
// ==============================

/**
 * Cria um novo draft de link rastreado.
 *
 * O draft representa um link ainda editável pelo utilizador
 * antes de ser normalizado para envio.
 */
export function makeTrackedLinkDraft() {
  return {
    id: makeId(),
    key: "",
    label: "",
    destinationUrl: "",
  };
}

/**
 * Normaliza a key de um link rastreado.
 *
 * A key é usada em placeholders como {{link.exemplo}}.
 * Deve ser segura, previsível e sem caracteres problemáticos.
 */
export function sanitizeTrackedKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Substitui placeholders de tracked links no preview da mensagem.
 *
 * No texto real do composer podem existir tokens como {{link.key}}.
 * Para preview, estes tokens são trocados pelo URL correspondente
 * ou por uma representação adequada ao canal.
 */
export function replaceTrackedPlaceholders(
  str = "",
  trackedLinks = [],
  channel = "teams",
) {
  let out = String(str || "");

  for (const link of trackedLinks) {
    const placeholder = `{{link.${link.key}}}`;
    const replacement =
      channel === "teams"
        ? `[${link.label || link.key}](${placeholder})`
        : placeholder;

    out = out.split(placeholder).join(replacement);
  }

  return out;
}

/**
 * Converte tracked links em opções para selects da UI.
 *
 * Usado especialmente quando um template WhatsApp precisa de escolher
 * qual tracked link alimenta o botão URL.
 */
export function getTrackedLinkOptions(trackedLinks) {
  return (trackedLinks || [])
    .map((link) => {
      const key = sanitizeTrackedKey(link.key);

      return {
        value: key,
        label: key ? `${key}${link.label ? ` — ${link.label}` : ""}` : "",
      };
    })
    .filter((option) => option.value);
}

/**
 * Normaliza os tracked links antes de envio.
 *
 * Remove drafts incompletos e devolve apenas os dados necessários
 * para o payload final.
 */
export function normalizeComposerTrackedLinks(trackedLinks) {
  return (trackedLinks || [])
    .map((link) => ({
      key: sanitizeTrackedKey(link.key),
      label: String(link.label || "").trim(),
      destinationUrl: String(link.destinationUrl || "").trim(),
    }))
    .filter((link) => link.key && link.label && link.destinationUrl);
}

/**
 * Valida se os tracked links do composer estão completos.
 *
 * Impede links sem key, sem URL ou com keys duplicadas.
 */
export function areComposerTrackedLinksValid(trackedLinks) {
  const normalized = normalizeComposerTrackedLinks(trackedLinks);
  const uniqueKeys = new Set(normalized.map((link) => link.key));

  return (
    normalized.length === (trackedLinks || []).length &&
    uniqueKeys.size === normalized.length
  );
}

/**
 * Valida a ligação entre templates WhatsApp com botão URL
 * e tracked links disponíveis.
 *
 * Quando o template exige uma variável de URL, o utilizador precisa
 * escolher qual tracked link será usado nesse botão.
 */
export function isWhatsappUrlBindingValid({
  needsUrlVar,
  selectedTrackedUrlKey,
}) {
  return !needsUrlVar || Boolean(selectedTrackedUrlKey);
}

// ==============================
// Read chain helpers
// ==============================

// Limite máximo permitido para atraso entre mensagens de uma read chain.
// Mantemos este valor centralizado para garantir consistência entre validação e UI.
export const MAX_CHAIN_DELAY_MINUTES = 10080; // 7 days
export const MAX_CHAIN_DELAY_HOURS = 168;

/**
 * Cria um step vazio de read chain.
 *
 * Cada step representa uma mensagem da sequência, com texto,
 * anexos, links rastreados e atraso após a leitura anterior.
 */
export function makeChainStep(overrides = {}) {
  return {
    id: makeId(),
    message: "",
    files: [],
    trackedLinks: [],
    selectedTrackedUrlKey: "",
    delayAfterPreviousReadMinutes: 0,
    ...overrides,
  };
}

/**
 * Formata a descrição do atraso entre mensagens de uma read chain.
 *
 * Usa traduções para apresentar minutos, horas ou ambos.
 */
export function formatDelayLabel(minutes, translation) {
  const value = Number(minutes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return translation("Broadcast.broadcastChain.chainNoDelay");
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (hours === 0) {
    return translation("Broadcast.broadcastChain.chainDelayMinutes", {
      minutes: remainingMinutes,
    });
  }

  if (remainingMinutes === 0) {
    return translation("Broadcast.broadcastChain.chainDelayHours", {
      hours,
    });
  }

  return translation("Broadcast.broadcastChain.chainDelayMinutesHours", {
    minutes: remainingMinutes,
    hours,
  });
}

/**
 * Divide um atraso em minutos em horas e minutos.
 *
 * Usado pelos inputs da UI para editar atrasos de read chains.
 */
export function splitDelayMinutes(totalMinutes) {
  const total = Number(totalMinutes || 0);

  if (!Number.isFinite(total) || total <= 0) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

/**
 * Normaliza o atraso de um step em minutos.
 *
 * Garante que o valor é numérico e fica dentro dos limites aceites.
 */
export function normalizeDelayMinutes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.min(Math.floor(number), MAX_CHAIN_DELAY_MINUTES);
}

/**
 * Valida se o atraso de um step está dentro dos limites aceites.
 *
 * O primeiro step não precisa de atraso porque inicia a sequência.
 */
export function chainStepDelayValid(step, index) {
  if (index === 0) return true;

  const value = Number(step.delayAfterPreviousReadMinutes || 0);

  return (
    Number.isFinite(value) && value >= 0 && value <= MAX_CHAIN_DELAY_MINUTES
  );
}

/**
 * Verifica se um step tem conteúdo suficiente para ser enviado.
 *
 * Cada step precisa de texto ou pelo menos um anexo.
 */
export function chainStepHasContent(step) {
  return (
    String(step.message || "").trim().length > 0 ||
    (Array.isArray(step.files) && step.files.length > 0)
  );
}

/**
 * Normaliza os tracked links de um step de read chain.
 *
 * Remove links incompletos antes de construir o payload final.
 */
export function normalizeTrackedLinksForStep(step) {
  return (step.trackedLinks || [])
    .map((link) => ({
      key: sanitizeTrackedKey(link.key),
      label: String(link.label || "").trim(),
      destinationUrl: String(link.destinationUrl || "").trim(),
    }))
    .filter((link) => link.key && link.label && link.destinationUrl);
}

/**
 * Valida se os tracked links de um step estão completos e sem duplicados.
 */
export function trackedLinksValidForStep(step) {
  const normalized = normalizeTrackedLinksForStep(step);

  return (
    normalized.length === (step.trackedLinks || []).length &&
    new Set(normalized.map((link) => link.key)).size === normalized.length
  );
}

/**
 * Valida se uma read chain pode ser enviada ou agendada.
 *
 * Regras principais:
 * - a feature tem de estar ativa para a organização;
 * - o canal tem de ser WhatsApp;
 * - tem de existir template fallback válido;
 * - a chain deve ter o número permitido de steps;
 * - cada step precisa de conteúdo válido;
 * - os tracked links dos steps têm de estar válidos;
 * - os atrasos têm de estar dentro dos limites.
 */
export function isReadChainValid({
  chainMode,
  readChainsFeatureEnabled,
  channel,
  hasFallbackTemplate,
  chainSteps,
}) {
  if (!chainMode) return true;

  const steps = Array.isArray(chainSteps) ? chainSteps : [];

  return (
    Boolean(readChainsFeatureEnabled) &&
    channel === "whatsapp" &&
    Boolean(hasFallbackTemplate) &&
    steps.length >= 2 &&
    steps.length <= 10 &&
    steps.every(chainStepHasContent) &&
    steps.every(trackedLinksValidForStep) &&
    steps.every(chainStepDelayValid)
  );
}

// ==============================
// WhatsApp template helpers
// ==============================

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
        if (key === "url" && typeof value === "string" && value.includes("{{")) {
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

// ==============================
// Payload helpers
// ==============================

/**
 * Constrói o payload do template fallback WhatsApp.
 *
 * Usado em broadcasts WhatsApp e read chains quando existe template
 * selecionado e os parâmetros estão completos.
 */
export function buildFallbackTemplatePayload({
  chosenTemplate,
  tplName,
  tplLang,
  paramsComplete,
  orderedParamValues,
  varDefs,
  tplParamsManual,
  needsUrlVar,
  selectedTrackedUrlKey,
}) {
  if (!tplName || !tplLang || !paramsComplete) return null;

  return {
    projectId: chosenTemplate?.projectId,
    name: tplName.trim(),
    languageCode: (tplLang || "pt-PT").trim(),
    params: orderedParamValues,
    varKeys: varDefs.length ? varDefs.map((variable) => variable.key) : [],
    manualParams: varDefs.length ? undefined : tplParamsManual,
    trackedUrlKey:
      needsUrlVar && selectedTrackedUrlKey ? selectedTrackedUrlKey : null,
  };
}

/**
 * Constrói a lista de destinatários WhatsApp para payloads de envio.
 *
 * Remove utilizadores sem dados suficientes para contacto WhatsApp/Bird.
 */
export function buildWhatsappRecipients(users) {
  return (users || [])
    .filter(
      (user) => user.phone_number || user.whatsapp_bsuid || user.bird_contact_id,
    )
    .map((user) => ({
      userId: user.id,
      name: user.name || null,
      phoneNumber: user.phone_number || null,
      whatsappBsuid: user.whatsapp_bsuid || null,
      whatsappUsername: user.whatsapp_username || null,
      birdContactId: user.bird_contact_id || null,
    }));
}

/**
 * Constrói o payload específico para Broadcast Teams.
 */
export function buildTeamsBroadcastPayload({
  orgId,
  users,
  message,
  files,
  trackedLinks,
}) {
  return {
    orgId,
    userIds: (users || []).map((user) => user.id),
    message,
    files,
    trackedLinks,
  };
}

/**
 * Constrói o payload específico para Broadcast WhatsApp.
 */
export function buildWhatsappBroadcastPayload({
  orgId,
  users,
  message,
  imageUrls,
  files,
  trackedLinks,
  template,
}) {
  return {
    orgId,
    message,
    imageUrls,
    files,
    trackedLinks,
    recipients: buildWhatsappRecipients(users),
    template,
  };
}

/**
 * Constrói o payload final de um broadcast simples.
 *
 * A estrutura muda conforme o canal:
 * - Teams usa ids de utilizadores;
 * - WhatsApp precisa de dados de contacto compatíveis com envio externo.
 *
 * Esta função não envia nada. Apenas prepara o body para a API.
 */
export function buildBroadcastPayload({
  channel,
  orgId,
  users,
  message,
  imageUrls,
  files,
  trackedLinks,
  template,
}) {
  if (channel === "whatsapp") {
    return buildWhatsappBroadcastPayload({
      orgId,
      users,
      message,
      imageUrls,
      files,
      trackedLinks,
      template,
    });
  }

  return buildTeamsBroadcastPayload({
    orgId,
    users,
    message,
    files,
    trackedLinks,
  });
}

/**
 * Constrói o payload de uma read chain WhatsApp.
 *
 * Inclui destinatários, utilizador criador, template fallback
 * e os steps que compõem a sequência.
 */
export function buildReadChainPayload({
  orgId,
  createdByUserId,
  users,
  fallbackTemplate,
  steps,
}) {
  return {
    orgId,
    createdByUserId,
    channel: "whatsapp",
    fallbackTemplate,
    recipients: buildWhatsappRecipients(users),
    steps: (steps || []).map((step, index) => ({
      message: step.message || "",
      files: Array.isArray(step.files) ? step.files : [],
      trackedLinks: normalizeTrackedLinksForStep(step),
      delayAfterPreviousReadMinutes:
        index === 0
          ? 0
          : normalizeDelayMinutes(step.delayAfterPreviousReadMinutes),
    })),
  };
}

/**
 * Converte uma data de agendamento para ISO string.
 */
function toScheduleIsoString(dateValue) {
  return dateValue instanceof Date
    ? dateValue.toISOString()
    : new Date(dateValue).toISOString();
}

/**
 * Constrói o payload de agendamento de um broadcast simples.
 *
 * Envolve o payload real de envio com metadados de agendamento,
 * como data, timezone, organização e número de destinatários.
 */
export function buildScheduledBroadcastPayload({
  orgId,
  createdByUserId,
  channel,
  scheduledDate,
  timezone,
  payload,
  recipientCount,
}) {
  return {
    orgId,
    createdByUserId,
    channel,
    scheduledFor: toScheduleIsoString(scheduledDate),
    timezone,
    payload,
    recipientCount,
  };
}

/**
 * Constrói o payload de agendamento de uma read chain.
 *
 * A primeira mensagem será enviada na data agendada.
 * As mensagens seguintes dependem das regras da read chain.
 */
export function buildScheduledReadChainPayload({
  chainPayload,
  scheduledDate,
  timezone,
}) {
  return {
    ...chainPayload,
    scheduledFor: toScheduleIsoString(scheduledDate),
    timezone,
  };
}

// ==============================
// Result helpers
// ==============================

/**
 * Extrai totais de sucesso e falha da resposta da API.
 *
 * Garante que a UI consegue mostrar feedback consistente,
 * mesmo quando a resposta do endpoint muda ligeiramente.
 */
export function getBroadcastCounts(data, fallbackTotal = 0) {
  if (!data || typeof data !== "object") {
    return {
      ok: fallbackTotal,
      failed: 0,
      total: fallbackTotal,
    };
  }

  const results = Array.isArray(data.results) ? data.results : [];

  const ok = Number.isFinite(Number(data.ok))
    ? Number(data.ok)
    : Number.isFinite(Number(data.successes))
      ? Number(data.successes)
      : results.length
        ? results.filter((result) => result.ok).length
        : fallbackTotal;

  const failed = Number.isFinite(Number(data.failed))
    ? Number(data.failed)
    : Number.isFinite(Number(data.failures))
      ? Number(data.failures)
      : results.length
        ? results.length - ok
        : 0;

  return {
    ok,
    failed,
    total: ok + failed,
  };
}

/**
 * Normaliza um contacto telefónico para comparação.
 */
export function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Compara dois telefones ignorando símbolos e prefixos parciais.
 */
export function phonesMatch(a, b) {
  const digitsA = normalizePhoneDigits(a);
  const digitsB = normalizePhoneDigits(b);

  if (!digitsA || !digitsB) return false;

  return digitsA === digitsB || digitsA.endsWith(digitsB) || digitsB.endsWith(digitsA);
}

/**
 * Extrai uma mensagem de erro legível a partir de um resultado de envio.
 */
export function getResultReason(result) {
  if (!result) return "Unknown error.";

  if (result.error) return String(result.error);
  if (result.reason) return String(result.reason);

  if (typeof result.data === "string" && result.data.trim()) {
    return result.data.trim();
  }

  if (result.data?.error) return String(result.data.error);
  if (result.data?.message) return String(result.data.message);
  if (result.data?.detail) return String(result.data.detail);

  if (result.status) {
    return `Request failed with status ${result.status}.`;
  }

  return "Unknown error.";
}

/**
 * Identifica os destinatários que falharam no envio.
 *
 * Ajuda a mostrar feedback mais útil ao utilizador depois
 * de um broadcast imediato ou agendado.
 */
export function getFailedRecipients(data, selectedUsers, channel) {
  if (!data || typeof data !== "object") return [];

  const results = Array.isArray(data.results) ? data.results : [];

  return results
    .filter((result) => !result.ok)
    .map((result) => {
      let matchedUser = null;

      if (channel === "teams") {
        matchedUser = selectedUsers.find(
          (user) => String(user.id) === String(result.userId),
        );
      } else {
        matchedUser =
          selectedUsers.find(
            (user) => String(user.id) === String(result.userId),
          ) ||
          selectedUsers.find((user) =>
            phonesMatch(
              user.phone_number || user.phoneNumber,
              result.recipient || result.to,
            ),
          ) ||
          selectedUsers.find(
            (user) =>
              result.whatsappBsuid &&
              String(user.whatsapp_bsuid || user.whatsappBsuid) ===
                String(result.whatsappBsuid),
          ) ||
          selectedUsers.find(
            (user) =>
              result.birdContactId &&
              String(user.bird_contact_id || user.birdContactId) ===
                String(result.birdContactId),
          );
      }

      const fallbackIdentifier =
        result.recipient ||
        result.to ||
        result.whatsappUsername ||
        result.whatsappBsuid ||
        result.birdContactId ||
        result.userId ||
        result.email ||
        "Unknown recipient";

      const label =
        matchedUser?.name ||
        matchedUser?.email ||
        matchedUser?.phone_number ||
        matchedUser?.whatsapp_username ||
        matchedUser?.whatsapp_bsuid ||
        fallbackIdentifier;

      const contact =
        channel === "teams"
          ? matchedUser?.email || result.userId || ""
          : matchedUser?.phone_number ||
            matchedUser?.whatsapp_username ||
            matchedUser?.whatsapp_bsuid ||
            result.to ||
            result.recipient ||
            result.whatsappBsuid ||
            result.birdContactId ||
            "";

      return {
        label,
        contact,
        reason: getResultReason(result),
      };
    });
}

/**
 * Formata a lista de destinatários falhados.
 *
 * Limita o número mostrado para evitar alertas demasiado longos.
 */
export function formatFailedRecipients(failedRecipients, maxToShow = 8) {
  if (!failedRecipients.length) return "";

  const visible = failedRecipients.slice(0, maxToShow);

  const lines = visible.map((recipient) => {
    const contact =
      recipient.contact && String(recipient.contact) !== String(recipient.label)
        ? ` (${recipient.contact})`
        : "";

    return `- ${recipient.label}${contact}: ${recipient.reason}`;
  });

  const hiddenCount = failedRecipients.length - visible.length;

  if (hiddenCount > 0) {
    lines.push(`- And ${hiddenCount} more...`);
  }

  return `Failed recipients:\n${lines.join("\n")}`;
}

/**
 * Formata a mensagem final apresentada ao utilizador.
 *
 * Junta canal, ação, totais, nota opcional e destinatários falhados
 * numa mensagem legível para alertas de sucesso ou aviso.
 */
export function formatBroadcastResultMessage({
  channel,
  action,
  ok,
  failed,
  note,
  failedRecipients = [],
}) {
  const channelLabel = channel === "whatsapp" ? "WhatsApp" : "Teams";

  const successLabel = ok === 1 ? "1 success" : `${ok} successes`;
  const failedLabel = failed === 1 ? "1 fail" : `${failed} fails`;

  const mainMessage = `${channelLabel} broadcast ${action} with ${successLabel} and ${failedLabel}.`;
  const failureDetails = formatFailedRecipients(failedRecipients);

  return [mainMessage, note, failureDetails].filter(Boolean).join("\n\n");
}