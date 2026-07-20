// /lib/repos/pendingOutreach.repo.js
require("dotenv").config();
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function createPendingOutreach({
  orgId,
  userId,
  payload,
  expiresAt, // Date or ISO string
  messageChainId = null,
  messageChainStepId = null,
  messageChainRecipientId = null,
  messageChainStepIndex = null,
  workerId,
  leaseSeconds = 120,
}) {
  const expiresISO =
    expiresAt instanceof Date
      ? expiresAt.toISOString()
      : new Date(expiresAt).toISOString();
  const { data, error } = await supabase
    .rpc("reserve_pending_outreach", {
      p_organization_id: orgId,
      p_user_id: userId,
      p_payload: payload,
      p_expires_at: expiresISO,
      p_message_chain_id: messageChainId,
      p_message_chain_step_id: messageChainStepId,
      p_message_chain_recipient_id: messageChainRecipientId,
      p_message_chain_step_index: messageChainStepIndex,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function completePendingOutreachTemplateReservation({
  id,
  organizationId,
  userId,
  claimToken,
  templateMessageId,
}) {
  const { data, error } = await supabase
    .rpc("complete_pending_outreach_template_reservation", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_claim_token: claimToken,
      p_template_message_id: templateMessageId,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function failPendingOutreachTemplateReservation({
  id,
  organizationId,
  userId,
  claimToken,
  lastError = null,
}) {
  const { data, error } = await supabase
    .rpc("fail_pending_outreach_template_reservation", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_claim_token: claimToken,
      p_last_error: lastError,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function renewPendingOutreachTemplateReservation({
  id,
  organizationId,
  userId,
  claimToken,
  leaseSeconds = 120,
}) {
  const { data, error } = await supabase
    .rpc("renew_pending_outreach_template_reservation", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_claim_token: claimToken,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function markPendingOutreachTemplateSendStarted({
  id,
  organizationId,
  userId,
  claimToken,
}) {
  const { data, error } = await supabase
    .rpc("mark_pending_outreach_template_send_started", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_claim_token: claimToken,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

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

export async function claimPendingOutreachForReply({
  organizationId,
  userId,
  webhookEventId,
  eventClaimToken,
  workerId,
  leaseSeconds = 120,
}) {
  const { data, error } = await supabase
    .rpc("claim_pending_outreach_for_reply", {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_webhook_event_id: webhookEventId,
      p_event_claim_token: eventClaimToken,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function maintainPendingOutreach({ limit = 25 } = {}) {
  const { data, error } = await supabase.rpc("maintain_pending_outreach", {
    p_limit: limit,
  });
  if (error) throw error;
  return (
    data?.[0] ?? {
      failed_count: 0,
      expired_count: 0,
      unknown_outcome_count: 0,
    }
  );
}

export async function renewPendingOutreachForWebhook({
  id,
  organizationId,
  userId,
  webhookEventId,
  eventClaimToken,
  claimToken,
  leaseSeconds = 120,
}) {
  const { data, error } = await supabase
    .rpc("renew_pending_outreach_for_webhook", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_webhook_event_id: webhookEventId,
      p_event_claim_token: eventClaimToken,
      p_claim_token: claimToken,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function markPendingOutreachSendStarted({
  id,
  organizationId,
  userId,
  webhookEventId,
  eventClaimToken,
  claimToken,
}) {
  const { data, error } = await supabase
    .rpc("mark_pending_outreach_send_started", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_webhook_event_id: webhookEventId,
      p_event_claim_token: eventClaimToken,
      p_claim_token: claimToken,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function transitionPendingOutreachForWebhook({
  id,
  organizationId,
  userId,
  webhookEventId,
  eventClaimToken,
  claimToken,
  status,
  replyMessageId = null,
  lastError = null,
  nextAttemptAt = null,
}) {
  const { data, error } = await supabase
    .rpc("transition_pending_outreach_for_webhook", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_webhook_event_id: webhookEventId,
      p_event_claim_token: eventClaimToken,
      p_claim_token: claimToken,
      p_status: status,
      p_reply_message_id: replyMessageId,
      p_last_error: lastError,
      p_next_attempt_at: nextAttemptAt,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
