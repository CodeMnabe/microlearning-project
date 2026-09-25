/**
 * Template de abertura da janela de 24h.
 *
 * Existe um único template WhatsApp, aprovado uma vez no Bird e partilhado
 * por todas as organizações. Serve apenas para reabrir a conversa com quem
 * está fora da janela. O início e o fim são fixos; só o corpo (variável
 * "mensagem") é personalizável por organização.
 *
 * Este ficheiro não lê variáveis de ambiente fora de getOpeningTemplateConfig,
 * por isso pode ser importado tanto no servidor como no browser.
 */

export const OPENING_TEMPLATE_VARIABLES = {
  name: "nome",
  company: "empresa",
  body: "mensagem",
};

export const OPENING_TEMPLATE_INTRO =
  "Olá {{nome}}!\n\nDesejas receber comunicações da {{empresa}}?";

export const OPENING_TEMPLATE_OUTRO =
  "Confirma a tua escolha clicando no botão abaixo.";

export const OPENING_TEMPLATE_BUTTON = "Aceito";

export const DEFAULT_OPENING_BODY =
  "Com isto, garantimos que recebes atempadamente todas as comunicações essenciais e informações úteis para ti";

/*
 * A Meta limita o corpo de um template a 1024 caracteres, já com as
 * variáveis preenchidas. O início e o fim ocupam cerca de 130, por isso
 * este limite deixa margem para nomes de organização compridos.
 */
export const OPENING_BODY_MAX_LENGTH = 600;

/**
 * Normaliza o corpo escrito pelo owner. Os valores de variáveis WhatsApp não
 * podem ter quebras de linha, tabulações nem sequências longas de espaços,
 * por isso todo o espaço em branco passa a um único espaço.
 */
export function sanitizeOpeningBody(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Devolve o corpo a usar: o da organização, ou o texto por omissão quando a
 * organização ainda não definiu nenhum.
 */
export function resolveOpeningBody(orgBody) {
  const clean = sanitizeOpeningBody(orgBody);
  return clean || DEFAULT_OPENING_BODY;
}

function fill(text, values) {
  return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    values[key] == null ? "" : String(values[key]),
  );
}

/**
 * Texto completo da mensagem, tal como o contacto a vê. Usado nas
 * pré-visualizações.
 */
export function renderOpeningMessage({ name, orgName, body } = {}) {
  const values = {
    [OPENING_TEMPLATE_VARIABLES.name]: name || "",
    [OPENING_TEMPLATE_VARIABLES.company]: orgName || "",
  };

  return [
    fill(OPENING_TEMPLATE_INTRO, values),
    resolveOpeningBody(body),
    OPENING_TEMPLATE_OUTRO,
  ].join("\n\n");
}

/**
 * Parâmetros do template no formato "chave=valor" esperado pelo envio ao
 * Bird, pela ordem das variáveis do template.
 */
export function buildOpeningTemplateParams({ userName, orgName, body } = {}) {
  return [
    `${OPENING_TEMPLATE_VARIABLES.name}=${userName || ""}`,
    `${OPENING_TEMPLATE_VARIABLES.company}=${orgName || ""}`,
    `${OPENING_TEMPLATE_VARIABLES.body}=${resolveOpeningBody(body)}`,
  ];
}

/**
 * Configuração do template no Bird. Só para o servidor.
 *
 * O id guardado é o do projeto, que é estável; cada edição no Bird cria uma
 * nova versão, e o envio pede sempre a mais recente.
 */
export function getOpeningTemplateConfig(env = process.env) {
  const projectId = String(env.BIRD_OPENING_TEMPLATE_PROJECT_ID || "").trim();

  if (!projectId) {
    const error = new Error(
      "Missing BIRD_OPENING_TEMPLATE_PROJECT_ID: the WhatsApp opening template is not configured",
    );
    error.status = 500;
    throw error;
  }

  return {
    projectId,
    locale: String(env.BIRD_OPENING_TEMPLATE_LOCALE || "pt-PT").trim(),
  };
}
