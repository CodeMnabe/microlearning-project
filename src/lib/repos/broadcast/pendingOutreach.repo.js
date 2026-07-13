// /lib/repos/pendingOutreach.repo.js
require("dotenv").config();
import { createClient as createServiceClient } from "@supabase/supabase-js";


/**
 * Repositório de pending outreach.
 *
 * Guarda contactos/mensagens que não puderam avançar imediatamente,
 * normalmente porque a janela de 24h do WhatsApp não está aberta.
 *
 * Este repo é responsável apenas por persistir e consultar estados pendentes.
 * A decisão de criar pending outreach pertence ao service de Broadcast.
 */

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/**
 * Cria um registo de outreach pendente.
 *
 * Usado quando não é possível continuar uma conversa WhatsApp
 * sem recorrer a template ou ação futura.
 */

export async function createPendingOutreach({
  orgId,
  userId,
  payload,
  expiresAt, // Date or ISO string
  templateMessageId = null,
  messageChainId = null,
  messageChainStepId = null,
  messageChainRecipientId = null,
  messageChainStepIndex = null,
}) {
  const expiresISO =
    expiresAt instanceof Date
      ? expiresAt.toISOString()
      : new Date(expiresAt).toISOString();
  const { data, error } = await supabase
    .from("pending_outreach")
    .insert([
      {
        org_id: orgId,
        user_id: userId,
        payload, // jsonb
        status: "pending",
        expires_at: expiresISO, // <- toISOString() (was toIsoString)
        template_message_id: templateMessageId,
        message_chain_id: messageChainId,
        message_chain_step_id: messageChainStepId,
        message_chain_recipient_id: messageChainRecipientId,
        message_chain_step_index: messageChainStepIndex,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Consulta registos de outreach pendente de uma organização.
 *
 * Pode ser usado para dashboards, automações ou acompanhamento operacional.
 */
export async function getAllPendingOutreachByUser(userId) {
  const { data, error } = await supabase
    .from("pending_outreach")
    .select(
      `
        id,
        org_id,
        user_id,
        payload,
        status,
        expires_at,
        template_message_id,
        message_chain_id,
        message_chain_step_id,
        message_chain_recipient_id,
        message_chain_step_index,
        created_at
      `,
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
/**
 * Atualiza o estado de um outreach pendente.
 *
 * Exemplo: resolvido, falhado, expirado ou processado.
 */

export async function markPendingOutreachReplied(id, replyMessageId) {
  const { data, error } = await supabase
    .from("pending_outreach") // <- was missing
    .update({
      status: "replied",
      reply_message_id: replyMessageId ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
