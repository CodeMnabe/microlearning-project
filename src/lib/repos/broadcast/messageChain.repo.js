/**
 * Repositório de read chains do Broadcast.
 *
 * Responsável por consultar e atualizar dados relacionados com:
 * - chains;
 * - recipients da chain;
 * - steps da chain;
 * - deliveries de cada step;
 * - progresso da sequência.
 *
 * Este repo deve conter apenas operações de base de dados.
 * A lógica de envio, delays e decisão do próximo step deve ficar nos services.
 */


import { createClient as createServiceClient } from "@supabase/supabase-js";


const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function nowIso() {
  return new Date().toISOString();
}

/**
 * Cria uma nova read chain na base de dados.
 *
 * Recebe dados já validados pelo service/API e devolve o registo criado.
 */
export async function createMessageChain({
  organizationId,
  createdByUserId = null,
  channel = "whatsapp",
  status = "active",
  scheduledFor = null,
  timezone = null,
  recipientCount = 0,
}) {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const { data, error } = await sb
    .from("message_chain")
    .insert({
      organization_id: organizationId,
      created_by_user_id: createdByUserId,
      channel,
      status,
      scheduled_for: scheduledFor,
      timezone,
      recipient_count: recipientCount,
      started_at: status === "active" ? nowIso() : null,
      processing_started_at: status === "processing" ? nowIso() : null,
      updated_at: nowIso(),
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function createMessageChainSteps({ chainId, steps }) {
  if (!chainId) {
    throw new Error("chainId is required");
  }

  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 10) {
    throw new Error("A read chain must have between 2 and 10 steps.");
  }

  const rows = steps.map((step, index) => ({
    chain_id: chainId,
    step_index: index + 1,
    payload: step,
  }));

  const { data, error } = await sb
    .from("message_chain_step")
    .insert(rows)
    .select("*")
    .order("step_index", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function createMessageChainRecipients({ chainId, recipients }) {
  if (!chainId) {
    throw new Error("chainId is required.");
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("At least one recipient is required.");
  }

  const rows = recipients.map((recipient) => ({
    chain_id: chainId,
    user_id: recipient.userId,
    status: "active",
    current_step_index: 0,
  }));

  const { data, error } = await sb
    .from("message_chain_recipient")
    .insert(rows)
    .select("*");

  if (error) throw error;

  return data || [];
}

export async function getMessageChainById(chainId) {
  const { data, error } = await sb
    .from("message_chain")
    .select("*")
    .eq("id", chainId)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function getMessageChainStep({ chainId, stepIndex }) {
  const { data, error } = await sb
    .from("message_chain_step")
    .select("*")
    .eq("chain_id", chainId)
    .eq("step_index", stepIndex)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

/**
 * Regista destinatários associados a uma read chain.
 *
 * Cada recipient mantém o progresso individual dentro da sequência.
 */
export async function getMessageChainRecipientById(id) {
  const { data, error } = await sb
    .from("message_chain_recipient")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function getMessageChainRecipient({ chainId, userId }) {
  const { data, error } = await sb
    .from("message_chain_recipient")
    .select("*")
    .eq("chain_id", chainId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function getMessageChainRecipientsByChainId(chainId) {
  if (!chainId) {
    throw new Error("chainId is required.");
  }

  const { data, error } = await sb
    .from("message_chain_recipient")
    .select("*")
    .eq("chain_id", chainId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function claimDueScheduledMessageChains({ limit = 25 } = {}) {
  const { data: dueChains, error: selectError } = await sb
    .from("message_chain")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (selectError) throw selectError;

  if (!Array.isArray(dueChains) || dueChains.length === 0) {
    return [];
  }

  const claimed = [];

  for (const chain of dueChains) {
    const { data, error } = await sb
      .from("message_chain")
      .update({
        status: "processing",
        processing_started_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", chain.id)
      .eq("status", "scheduled")
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (data) {
      claimed.push(data);
    }
  }

  return claimed;
}

export async function markMessageChainActive(chainId) {
  const { data, error } = await sb
    .from("message_chain")
    .update({
      status: "active",
      started_at: nowIso(),
      error_message: null,
      updated_at: nowIso(),
    })
    .eq("id", chainId)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function markMessageChainFailed({ chainId, errorMessage }) {
  const { data, error } = await sb
    .from("message_chain")
    .update({
      status: "failed",
      error_message: errorMessage || "Read chain failed.",
      updated_at: nowIso(),
    })
    .eq("id", chainId)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * Cria ou atualiza uma delivery de read chain.
 *
 * Uma delivery representa a tentativa de envio de um step
 * para um destinatário específico.
 */
export async function createMessageChainDelivery({
  chainId,
  chainStepId,
  chainRecipientId,
  userId,
  messageDbId = null,
  providerMessageId = null,
  stepIndex,
  status = "sent",
  sentAt = new Date(),
  readAt = null,
  failedAt = null,
  dueAt = null,
  errorMessage = null,
}) {
  const { data, error } = await sb
    .from("message_chain_delivery")
    .upsert(
      {
        chain_id: chainId,
        chain_step_id: chainStepId,
        chain_recipient_id: chainRecipientId,
        user_id: userId,
        message_id: messageDbId,
        provider_message_id: providerMessageId,
        step_index: stepIndex,
        status,
        sent_at: sentAt ? new Date(sentAt).toISOString() : null,
        read_at: readAt ? new Date(readAt).toISOString() : null,
        failed_at: failedAt ? new Date(failedAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        error: errorMessage,
        updated_at: nowIso(),
      },
      {
        onConflict: "chain_recipient_id,step_index",
      },
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getMessageChainDelivery({ chainRecipientId, stepIndex }) {
  const { data, error } = await sb
    .from("message_chain_delivery")
    .select("*")
    .eq("chain_recipient_id", chainRecipientId)
    .eq("step_index", stepIndex)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function claimDueScheduledMessageChainDeliveries({ limit = 50 }) {
  const { data: dueDeliveries, error: selectError } = await sb
    .from("message_chain_delivery")
    .select("*")
    .eq("status", "scheduled")
    .lte("due_at", nowIso())
    .order("due_at", { ascending: true })
    .limit(limit);

  if (selectError) throw selectError;

  if (!Array.isArray(dueDeliveries) || dueDeliveries.length === 0) {
    return [];
  }

  const claimed = [];

  for (const delivery of dueDeliveries) {
    const { data, error } = await sb
      .from("message_chain_delivery")
      .update({
        status: "processing",
        updated_at: nowIso(),
      })
      .eq("id", delivery.id)
      .eq("status", "scheduled")
      .select("*")
      .maybeSingle();

    if (error) throw error;

    if (data) {
      claimed.push(data);
    }
  }

  return claimed;
}

export async function markMessageChainDeliveryRead({
  chainRecipientId,
  stepIndex,
  readAt = new Date(),
}) {
  const iso = new Date(readAt).toISOString();

  const { data, error } = await sb
    .from("message_chain_delivery")
    .update({
      status: "read",
      read_at: iso,
      updated_at: nowIso(),
    })
    .eq("chain_recipient_id", chainRecipientId)
    .eq("step_index", stepIndex)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function markMessageChainDeliveryFailed({
  chainRecipientId,
  stepIndex,
  errorMessage,
}) {
  const { data, error } = await sb
    .from("message_chain_delivery")
    .update({
      status: "failed",
      failed_at: nowIso(),
      error: errorMessage,
      updated_at: nowIso(),
    })
    .eq("chain_recipient_id", chainRecipientId)
    .eq("step_index", stepIndex)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

/**
 * Atualiza o progresso de um destinatário dentro da read chain.
 *
 * Usado quando um step é enviado, lido, falha ou quando a sequência termina.
 */

export async function updateMessageChainRecipientProgress({
  chainRecipientId,
  currentStepIndex,
  status = null,
}) {
  const patch = {
    current_step_index: currentStepIndex,
    updated_at: nowIso(),
  };

  if (status) {
    patch.status = status;
  }

  const { data, error } = await sb
    .from("message_chain_recipient")
    .update(patch)
    .eq("id", chainRecipientId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function completeMessageChainRecipient({
  chainRecipientId,
  reason = null,
}) {
  const { data, error } = await sb
    .from("message_chain_recipient")
    .update({
      status: "completed",
      completed_at: nowIso(),
      stopped_reason: reason,
      updated_at: nowIso(),
    })
    .eq("id", chainRecipientId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function stopMessageChainRecipient({ chainRecipientId, reason }) {
  const { data, error } = await sb
    .from("message_chain_recipient")
    .update({
      status: "stopped",
      stopped_reason: reason || "Stopped",
      updated_at: nowIso(),
    })
    .eq("id", chainRecipientId)
    .select()
    .single();

  if (error) throw error;

  return data;
}
