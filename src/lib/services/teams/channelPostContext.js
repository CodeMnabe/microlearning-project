import { getMessageByProviderId } from "@/lib/repos/messages.repo";

/* "19:canal@thread.tacv2;messageid=123" -> "123"; fora de um fio, null. */
export function channelPostRootId(conversationId) {
  const match = String(conversationId || "").match(/;messageid=([^;]+)/);

  return match ? match[1] : null;
}

/*
 * Num canal, cada publicação tem a sua conversa no assistente (#164). Se a
 * publicação que abriu o fio foi enviada pela plataforma, a conversa nova
 * começa com ela, para o assistente saber do que se fala por baixo dela.
 */
export async function getChannelPostContext({
  conversationId,
  organizationId,
  deps = { getMessageByProviderId },
}) {
  const rootId = channelPostRootId(conversationId);
  if (!rootId) return [];

  try {
    const root = await deps.getMessageByProviderId(rootId, organizationId);
    const content = String(root?.content || "").trim();

    if (root?.role !== "assistant" || !content) return [];

    return [{ type: "message", role: "assistant", content }];
  } catch (error) {
    /* O contexto é uma ajuda: sem ele a conversa continua a funcionar. */
    console.error("[TEAMS] channel post context failed", error?.message);
    return [];
  }
}
