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

export async function claimPendingOutreachForWebhook({
  id,
  organizationId,
  userId,
  webhookEventId,
  eventClaimToken,
  leaseSeconds = 120,
}) {
  const { data, error } = await supabase
    .rpc("claim_pending_outreach_for_webhook", {
      p_pending_outreach_id: id,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_webhook_event_id: webhookEventId,
      p_event_claim_token: eventClaimToken,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
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
