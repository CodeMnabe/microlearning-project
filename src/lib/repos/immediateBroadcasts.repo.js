import { createClient as createServiceClient } from "@supabase/supabase-js";
import { IMMEDIATE_BROADCAST_LEASE_SECONDS } from "@/lib/limits/costControls";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args).maybeSingle();
  if (error) {
    if (error.message?.includes("IDEMPOTENCY_PAYLOAD_MISMATCH"))
      error.status = 409;
    throw error;
  }
  return data ?? null;
}

export const reserveImmediateBroadcastRequest = (args) =>
  rpc("reserve_immediate_broadcast_request", {
    p_organization_id: args.organizationId,
    p_actor_user_id: args.actorUserId,
    p_channel: args.channel,
    p_idempotency_key: args.idempotencyKey,
    p_request_hash: args.requestHash,
    p_recipient_user_ids: args.recipientUserIds,
    p_worker_id: args.workerId,
    p_lease_seconds: IMMEDIATE_BROADCAST_LEASE_SECONDS,
  });

export const recoverImmediateBroadcastRequest = (args) =>
  rpc("recover_immediate_broadcast_request", {
    p_request_id: args.requestId,
    p_organization_id: args.organizationId,
    p_actor_user_id: args.actorUserId,
    p_request_claim_token: args.requestClaimToken,
    p_worker_id: args.workerId,
    p_lease_seconds: IMMEDIATE_BROADCAST_LEASE_SECONDS,
    p_limit: 500,
  });

export const claimImmediateBroadcastDelivery = (args) =>
  rpc("claim_immediate_broadcast_delivery", {
    p_request_id: args.requestId,
    p_organization_id: args.organizationId,
    p_actor_user_id: args.actorUserId,
    p_request_claim_token: args.requestClaimToken,
    p_user_id: args.userId,
    p_worker_id: args.workerId,
    p_lease_seconds: IMMEDIATE_BROADCAST_LEASE_SECONDS,
  });

export const markImmediateBroadcastDeliverySendStarted = (args) =>
  rpc("mark_immediate_broadcast_delivery_send_started", {
    p_delivery_id: args.deliveryId,
    p_request_id: args.requestId,
    p_organization_id: args.organizationId,
    p_request_claim_token: args.requestClaimToken,
    p_claim_token: args.claimToken,
    p_worker_id: args.workerId,
  });

export const completeImmediateBroadcastDelivery = (args) =>
  rpc("complete_immediate_broadcast_delivery", {
    p_delivery_id: args.deliveryId,
    p_request_id: args.requestId,
    p_organization_id: args.organizationId,
    p_request_claim_token: args.requestClaimToken,
    p_claim_token: args.claimToken,
    p_worker_id: args.workerId,
    p_outcome: args.outcome,
    p_provider_message_id: args.providerMessageId || null,
    p_provider_result: args.providerResult || {},
    p_last_error: args.lastError || null,
  });

export const renewImmediateBroadcastRequestLease = (args) =>
  rpc("renew_immediate_broadcast_request_lease", {
    p_request_id: args.requestId,
    p_organization_id: args.organizationId,
    p_actor_user_id: args.actorUserId,
    p_request_claim_token: args.requestClaimToken,
    p_worker_id: args.workerId,
    p_lease_seconds: IMMEDIATE_BROADCAST_LEASE_SECONDS,
  });

export const getImmediateBroadcastRequestSummary = (args) =>
  rpc("get_immediate_broadcast_request_summary", {
    p_request_id: args.requestId,
    p_organization_id: args.organizationId,
    p_actor_user_id: args.actorUserId,
  });
