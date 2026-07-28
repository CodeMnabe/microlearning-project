/**
 * Resultados e feedback da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */
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

  return (
    digitsA === digitsB ||
    digitsA.endsWith(digitsB) ||
    digitsB.endsWith(digitsA)
  );
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
