/**
 * Obtém a inicial utilizada no avatar do utilizador.
 *
 * Mantém o comportamento atual:
 * - remove espaços no início e no fim;
 * - utiliza o primeiro caráter;
 * - devolve "?" quando o nome está vazio;
 * - converte o resultado para maiúsculas.
 */
export function getUserInitial(name = "") {
  return (name.trim()[0] || "?").toUpperCase();
}

/**
 * Normaliza a resposta recebida da API de utilizadores para o formato
 * atualmente utilizado pela interface.
 *
 * Esta função mantém os mesmos fallbacks e os mesmos nomes de propriedades
 * que existiam anteriormente dentro da page.
 */
export function normalizeUsers(users = []) {
  return users.map((user) => ({
    id: user.id,
    name: user.name,

    // Campo de telefone completo legado.
    phone: user.phone_number ?? user.phoneNumber ?? "",

    // Campos telefónicos separados.
    phoneCountryCode: user.phone_country_code ?? "",
    phoneNational: user.phone_national ?? "",

    email: user.email ?? "",

    tags:
      user.tag_names ??
      (user.tags || []).map((tag) => tag.name) ??
      [],

    tagIds:
      user.tag_ids ??
      (user.tags || []).map((tag) => tag.id) ??
      [],

    assistantId: user.assistant_id ?? null,

    teamsAadObjectId: user.teams_aad_object_id,
    teamsFromId: user.teams_from_id,

    assistantName: user.assistantName ?? "—",

    organization_id: user.organization_id,
  }));
}

/**
 * Aplica os filtros locais atualmente utilizados pela página.
 *
 * A pesquisa continua a ser executada apenas sobre os utilizadores
 * carregados na página atual.
 *
 * Regras mantidas:
 * - pesquisa por nome, telefone e email;
 * - filtro de tags com lógica AND;
 * - filtro de assistentes com lógica OR.
 */
export function filterUsers(
  users = [],
  searchQuery = "",
  selectedTagIds = [],
  selectedAssistantIds = [],
) {
  const normalizedQuery = searchQuery.toLowerCase();

  return users.filter((user) => {
    const textMatches = (
      user.name +
      " " +
      (user.phone || "") +
      " " +
      [user.phoneCountryCode, user.phoneNational].join(" ") +
      " " +
      (user.email || "")
    )
      .toLowerCase()
      .includes(normalizedQuery);

    const tagsMatch =
      selectedTagIds.length === 0 ||
      selectedTagIds.every((tagId) =>
        (user.tagIds || []).includes(tagId),
      );

    const assistantMatches =
      selectedAssistantIds.length === 0 ||
      selectedAssistantIds.includes(user.assistantId);

    return textMatches && tagsMatch && assistantMatches;
  });
}

/**
 * Constrói o mapa utilizado para obter rapidamente um assistente pelo ID.
 *
 * Os IDs continuam a ser convertidos para string, tal como anteriormente.
 */
export function buildAssistantsById(assistants = []) {
  const assistantsById = new Map();

  assistants.forEach((assistant) => {
    assistantsById.set(String(assistant.id), assistant);
  });

  return assistantsById;
}

/**
 * Calcula o número total de páginas.
 *
 * Mantém sempre pelo menos uma página, mesmo quando não existem utilizadores.
 */
export function calculateUsersTotalPages(totalUsers, pageSize) {
  return Math.max(1, Math.ceil(totalUsers / pageSize));
}

/**
 * Remove o prefixo telefónico do número completo.
 *
 * Mantém o comportamento anteriormente definido no EditUserModal.
 */
export function stripPhoneCountryCode(fullPhone, countryCode) {
  if (!fullPhone) return "";

  if (countryCode && fullPhone.startsWith(countryCode)) {
    return fullPhone.slice(countryCode.length);
  }

  return fullPhone.replace(/^\+/, "");
}