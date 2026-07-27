/**
 * Funções puras usadas na importação de utilizadores.
 *
 * Tratam da limpeza dos valores recebidos do ficheiro, da construção do
 * número de telefone e da deteção de utilizadores já existentes.
 */

export function cleanText(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function cleanEmail(value) {
  const email = cleanText(value).toLowerCase();
  return email || null;
}

export function cleanDigits(value) {
  return cleanText(value).replace(/\D/g, "");
}

export function cleanPhoneNumber(value) {
  const phone = cleanText(value).replace(/[^\d+]/g, "");
  return phone || null;
}

export function normalizeCountryCode(value) {
  const code = cleanText(value).replace(/[^\d+]/g, "");

  if (!code) return "";
  return code.startsWith("+") ? code : `+${code}`;
}

/**
 * Constrói o número completo.
 *
 * Um número explícito tem prioridade sobre a combinação de
 * indicativo com número nacional.
 */
export function buildFullPhone({
  phoneNumber,
  phoneCountryCode,
  phoneNational,
}) {
  const explicit = cleanPhoneNumber(phoneNumber);

  if (explicit) {
    return explicit;
  }

  const code = normalizeCountryCode(phoneCountryCode);
  const national = cleanDigits(phoneNational);

  if (code && national) {
    return `${code}${national}`;
  }

  return null;
}

export function parseAssistantId(value) {
  if (value === "" || value == null) return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * Aceita tags como lista ou como texto separado por vírgulas,
 * pontos e vírgulas ou linhas. Remove duplicados.
 */
export function parseTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((tag) => cleanText(tag)).filter(Boolean))];
  }

  const raw = cleanText(value);

  if (!raw) return [];

  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((tag) => cleanText(tag))
        .filter(Boolean),
    ),
  ];
}

/**
 * Obtém o identificador do utilizador criado.
 *
 * A criação pode devolver o utilizador em formatos diferentes,
 * por isso são testadas várias possibilidades.
 */
export function getCreatedUserId(resultValue) {
  return (
    resultValue?.id ||
    resultValue?.user?.id ||
    resultValue?.data?.id ||
    resultValue?.createdUser?.id ||
    resultValue?.[0]?.id ||
    null
  );
}

/**
 * Procura um utilizador existente que corresponda à linha importada.
 *
 * A correspondência é feita por identificador de Teams, email e telefone.
 * Se os critérios apontarem para utilizadores diferentes, o resultado é
 * um conflito e a linha deve ser ignorada.
 */
export function findExistingUserForImport({
  existingUsers,
  email,
  teamsAadObjectId,
  phoneNumber,
}) {
  const matches = [];

  if (teamsAadObjectId) {
    const match = existingUsers.find(
      (user) => cleanText(user.teams_aad_object_id) === teamsAadObjectId,
    );

    if (match) matches.push(match);
  }

  if (email) {
    const match = existingUsers.find(
      (user) => cleanEmail(user.email) === email,
    );

    if (match) matches.push(match);
  }

  if (phoneNumber) {
    const match = existingUsers.find(
      (user) => cleanPhoneNumber(user.phone_number) === phoneNumber,
    );

    if (match) matches.push(match);
  }

  const uniqueMatches = Array.from(
    new Map(matches.map((user) => [user.id, user])).values(),
  );

  if (uniqueMatches.length > 1) {
    return { status: "conflict", user: null };
  }

  if (uniqueMatches.length === 1) {
    return { status: "found", user: uniqueMatches[0] };
  }

  return { status: "not_found", user: null };
}
