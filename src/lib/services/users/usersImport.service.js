import { getSupabaseAdminClient } from "@/lib/db/admin";
import { getUsersInOrg, updateUserFields } from "@/lib/repos/user.repo";
import {
  addTagsToUser,
  getTagsByExactNamesInOrg,
} from "@/lib/repos/tag.repo.js";
import { createUserWithAutomations } from "@/lib/services/automations/createUserWithAutomations";

import {
  buildFullPhone,
  cleanDigits,
  cleanEmail,
  cleanText,
  findExistingUserForImport,
  getCreatedUserId,
  normalizeCountryCode,
  parseAssistantId,
  parseTags,
} from "./usersImport.helpers";

/**
 * Importação de utilizadores a partir de linhas já convertidas.
 *
 * O processo tem três fases:
 * 1. carregar as tags pedidas e os utilizadores já existentes;
 * 2. decidir, linha a linha, se cria, atualiza ou ignora;
 * 3. executar as operações e resumir o resultado.
 *
 * A importação corre com a service role, porque precisa de ler e escrever
 * em toda a organização.
 */

/**
 * Número máximo de utilizadores existentes carregados para comparação.
 */
const EXISTING_USERS_PAGE_SIZE = 1000;

/**
 * Carrega as tags pedidas no ficheiro, indexadas por nome.
 *
 * Só são carregadas as tags que já existem na organização. As restantes
 * fazem a linha ser ignorada, porque a importação não cria tags novas.
 */
async function loadTagsByName(admin, orgId, users) {
  const requestedTagNames = new Set();

  users.forEach((rawUser) => {
    parseTags(rawUser.tags).forEach((tagName) => {
      requestedTagNames.add(tagName);
    });
  });

  const tagRows = await getTagsByExactNamesInOrg(
    admin,
    orgId,
    Array.from(requestedTagNames),
  );

  const tagsByName = new Map();

  tagRows.forEach((tag) => {
    const name = cleanText(tag.name);

    if (name) {
      tagsByName.set(name, tag);
    }
  });

  return tagsByName;
}

/**
 * Decide o que fazer com cada linha do ficheiro.
 *
 * Devolve as operações a executar e as linhas ignoradas, com o motivo.
 *
 * Uma linha é ignorada quando:
 * - não tem email, identificador de Teams nem telefone;
 * - corresponde a mais do que um utilizador existente;
 * - é um utilizador novo sem nome;
 * - usa tags que não existem na organização;
 * - repete um utilizador ou um contacto já visto no mesmo ficheiro.
 */
function planImportRows({ users, orgId, tagsByName, existingUsers }) {
  const seenEmails = new Set();
  const seenAadIds = new Set();
  const seenPhones = new Set();
  const seenExistingUserIds = new Set();

  const skippedRows = [];
  const toProcess = [];

  users.forEach((rawUser, index) => {
    const rowNumber = index + 1;

    const name = cleanText(rawUser.name);
    const email = cleanEmail(rawUser.email);

    const teamsAadObjectId = cleanText(rawUser.teamsAadObjectId) || null;
    const teamsFromId = cleanText(rawUser.teamsFromId) || null;

    const phoneCountryCode =
      normalizeCountryCode(rawUser.phoneCountryCode) || null;
    const phoneNational = cleanDigits(rawUser.phoneNational) || null;

    const phoneNumber = buildFullPhone({
      phoneNumber: rawUser.phoneNumber,
      phoneCountryCode,
      phoneNational,
    });

    const assistantId = parseAssistantId(rawUser.assistantId);

    const tagNames = parseTags(rawUser.tags);

    const missingTagNames = tagNames.filter(
      (tagName) => !tagsByName.has(tagName),
    );

    if (!email && !teamsAadObjectId && !phoneNumber) {
      skippedRows.push({
        row: rowNumber,
        name,
        reason: "No email, Teams AAD Object ID, or phone number found",
      });
      return;
    }

    const matchResult = findExistingUserForImport({
      existingUsers,
      email,
      teamsAadObjectId,
      phoneNumber,
    });

    if (matchResult.status === "conflict") {
      skippedRows.push({
        row: rowNumber,
        name,
        reason:
          "Multiple matching users found. Email, phone, or Teams AAD Object ID belong to different users.",
      });
      return;
    }

    const existingUser = matchResult.user;
    const existingUserId = existingUser?.id || null;
    const displayName = name || cleanText(existingUser?.name);

    if (!existingUser && !name) {
      skippedRows.push({
        row: rowNumber,
        name: "",
        reason: "Missing name",
      });
      return;
    }

    if (missingTagNames.length) {
      skippedRows.push({
        row: rowNumber,
        name: displayName,
        reason: `Unknown tag(s): ${missingTagNames.join(", ")}`,
      });
      return;
    }

    if (existingUserId && seenExistingUserIds.has(existingUserId)) {
      skippedRows.push({
        row: rowNumber,
        name: displayName,
        reason: "Duplicate row for the same existing user",
      });
      return;
    }

    if (email && seenEmails.has(email)) {
      skippedRows.push({
        row: rowNumber,
        name: displayName,
        reason: "Duplicate email in import file",
      });
      return;
    }

    if (teamsAadObjectId && seenAadIds.has(teamsAadObjectId)) {
      skippedRows.push({
        row: rowNumber,
        name: displayName,
        reason: "Duplicate Teams AAD Object ID in import file",
      });
      return;
    }

    if (phoneNumber && seenPhones.has(phoneNumber)) {
      skippedRows.push({
        row: rowNumber,
        name: displayName,
        reason: "Duplicate phone number in import file",
      });
      return;
    }

    const tagIds = tagNames.map((tagName) => tagsByName.get(tagName).id);

    if (email) seenEmails.add(email);
    if (teamsAadObjectId) seenAadIds.add(teamsAadObjectId);
    if (phoneNumber) seenPhones.add(phoneNumber);
    if (existingUserId) seenExistingUserIds.add(existingUserId);

    if (existingUser) {
      const patch = {};

      if (name) patch.name = name;
      if (email) patch.email = email;
      if (assistantId) patch.assistant_id = assistantId;

      if (phoneNumber) {
        patch.phone_number = phoneNumber;
        patch.phone_country_code = phoneCountryCode || null;
        patch.phone_national = phoneNational || null;
      }

      if (teamsAadObjectId) patch.teams_aad_object_id = teamsAadObjectId;
      if (teamsFromId) patch.teams_from_id = teamsFromId;

      toProcess.push({
        action: "update",
        existingUserId: existingUser.id,
        patch,
        tagIds,
        name: displayName,
        __row: rowNumber,
      });

      return;
    }

    toProcess.push({
      action: "create",
      organizationId: orgId,
      name,
      email,
      assistantId,
      phoneNumber: phoneNumber || undefined,
      phoneCountryCode: phoneNumber ? phoneCountryCode || undefined : undefined,
      phoneNational: phoneNumber ? phoneNational || undefined : undefined,
      teamsAadObjectId,
      teamsFromId,
      tagIds,
      __row: rowNumber,
    });
  });

  return { toProcess, skippedRows };
}

/**
 * Executa uma operação planeada, de criação ou de atualização.
 */
async function executeImportItem(admin, orgId, item) {
  if (item.action === "update") {
    const updatedUser = await updateUserFields(admin, {
      userId: item.existingUserId,
      orgId,
      patch: item.patch,
    });

    if (item.tagIds.length) {
      await addTagsToUser(admin, item.existingUserId, item.tagIds);
    }

    return { action: "update", user: updatedUser };
  }

  const createdUser = await createUserWithAutomations({
    organizationId: item.organizationId,
    name: item.name,
    email: item.email,
    assistantId: item.assistantId,
    phoneNumber: item.phoneNumber,
    phoneCountryCode: item.phoneCountryCode,
    phoneNational: item.phoneNational,
    teamsAadObjectId: item.teamsAadObjectId,
    teamsFromId: item.teamsFromId,
  });

  const createdUserId = getCreatedUserId(createdUser);

  if (item.tagIds.length) {
    if (!createdUserId) {
      throw new Error(
        "User was created, but no user ID was returned to attach tags.",
      );
    }

    await addTagsToUser(admin, createdUserId, item.tagIds);
  }

  return { action: "create", user: createdUser };
}

/**
 * Executa todas as operações planeadas.
 *
 * As operações são independentes: uma falha não impede as restantes.
 */
async function executeImportPlan(admin, orgId, toProcess) {
  const results = await Promise.allSettled(
    toProcess.map((item) => executeImportItem(admin, orgId, item)),
  );

  const failedRows = [];
  let created = 0;
  let updated = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.action === "update") {
        updated += 1;
      } else {
        created += 1;
      }

      return;
    }

    const source = toProcess[index];

    const message =
      result.reason?.message ||
      result.reason?.error_description ||
      "Failed to process user";

    failedRows.push({
      row: source.__row,
      name: source.name,
      reason: message,
    });
  });

  return { created, updated, failedRows };
}

/**
 * Importa utilizadores para a organização indicada.
 *
 * Devolve o resumo com o total recebido, os criados, os atualizados,
 * os ignorados e os que falharam, com o motivo de cada um.
 */
export async function importUsers({ orgId, users }) {
  const admin = getSupabaseAdminClient();

  const tagsByName = await loadTagsByName(admin, orgId, users);

  const existingUsersResult = await getUsersInOrg(orgId, {
    page: 1,
    pageSize: EXISTING_USERS_PAGE_SIZE,
  });

  const existingUsers = existingUsersResult.items || [];

  const { toProcess, skippedRows } = planImportRows({
    users,
    orgId,
    tagsByName,
    existingUsers,
  });

  const { created, updated, failedRows } = await executeImportPlan(
    admin,
    orgId,
    toProcess,
  );

  return {
    totalReceived: users.length,
    created,
    updated,
    skipped: skippedRows.length,
    failed: failedRows.length,
    skippedRows,
    failedRows,
  };
}
