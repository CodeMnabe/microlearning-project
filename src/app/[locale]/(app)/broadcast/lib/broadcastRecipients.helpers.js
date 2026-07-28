/**
 * Destinatários da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */
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
