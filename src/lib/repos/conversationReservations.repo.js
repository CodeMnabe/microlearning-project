import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function registerConversationReservation({
  organizationId,
  provider,
  scopeId,
  userId = null,
  assistantId,
  channel,
  existingThreadId = null,
}) {
  const { data, error } = await supabase
    .rpc("register_conversation_reservation", {
      p_organization_id: organizationId,
      p_provider: provider,
      p_scope_id: scopeId,
      p_user_id: userId,
      p_assistant_id: assistantId,
      p_channel: channel,
      p_existing_thread_id: existingThreadId,
    })
    .single();
  if (error) throw error;
  return data;
}

export async function claimConversationReservation({
  reservationId,
  organizationId,
  leaseSeconds = 120,
}) {
  const { data, error } = await supabase
    .rpc("claim_conversation_reservation", {
      p_reservation_id: reservationId,
      p_organization_id: organizationId,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function renewConversationReservationLease({
  reservationId,
  organizationId,
  claimToken,
  leaseSeconds = 120,
}) {
  const { data, error } = await supabase
    .rpc("renew_conversation_reservation_lease", {
      p_reservation_id: reservationId,
      p_organization_id: organizationId,
      p_claim_token: claimToken,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function markConversationReservationRemoteStarted({
  reservationId,
  organizationId,
  claimToken,
}) {
  const { data, error } = await supabase
    .rpc("mark_conversation_reservation_remote_started", {
      p_reservation_id: reservationId,
      p_organization_id: organizationId,
      p_claim_token: claimToken,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function associateConversationReservationThread({
  reservationId,
  organizationId,
  claimToken,
  threadId,
}) {
  const { data, error } = await supabase
    .rpc("associate_conversation_reservation_thread", {
      p_reservation_id: reservationId,
      p_organization_id: organizationId,
      p_claim_token: claimToken,
      p_thread_id: threadId,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function transitionConversationReservation({
  reservationId,
  organizationId,
  claimToken,
  status,
  lastError = null,
}) {
  const { data, error } = await supabase
    .rpc("transition_conversation_reservation", {
      p_reservation_id: reservationId,
      p_organization_id: organizationId,
      p_claim_token: claimToken,
      p_status: status,
      p_last_error: lastError,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
