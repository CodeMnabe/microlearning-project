import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const REGISTRATION_OUTCOMES = new Set([
  "accepted",
  "duplicate_succeeded",
  "duplicate_processing",
  "retryable",
  "payload_conflict",
]);

export async function registerWebhookEvent(identity) {
  const { data, error } = await sb
    .rpc("register_webhook_event", {
      p_provider: identity.provider,
      p_organization_id: identity.organizationId,
      p_event_type: identity.eventType,
      p_scope_id: identity.scopeId,
      p_external_event_id: identity.externalEventId,
      p_payload_hash: identity.payloadHash,
      p_metadata: identity.metadata,
    })
    .single();

  if (error) throw error;
  if (!data || !REGISTRATION_OUTCOMES.has(data.outcome)) {
    throw new Error("Invalid register_webhook_event response");
  }

  return {
    outcome: data.outcome,
    eventId: data.event_id,
    status: data.event_status,
    attemptCount: data.attempt_count,
    claimExpiresAt: data.claim_expires_at,
  };
}

export async function claimWebhookEvents({
  workerId,
  limit = 25,
  leaseSeconds = 120,
}) {
  const { data, error } = await sb.rpc("claim_webhook_events", {
    p_worker_id: workerId,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });

  if (error) throw error;
  return data || [];
}

export async function transitionWebhookEvent({
  eventId,
  organizationId,
  claimToken,
  status,
  lastError = null,
  nextAttemptAt = null,
}) {
  const { data, error } = await sb
    .rpc("transition_webhook_event", {
      p_event_id: eventId,
      p_organization_id: organizationId,
      p_claim_token: claimToken,
      p_status: status,
      p_last_error: lastError,
      p_next_attempt_at: nextAttemptAt,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function renewWebhookEventLease({
  eventId,
  organizationId,
  claimToken,
  leaseSeconds = 120,
}) {
  const { data, error } = await sb
    .rpc("renew_webhook_event_lease", {
      p_event_id: eventId,
      p_organization_id: organizationId,
      p_claim_token: claimToken,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function registerWebhookEffect({
  eventId,
  organizationId,
  eventClaimToken,
  effectType,
  effectKey,
  isExternal,
  requestHash = null,
}) {
  const { data, error } = await sb
    .rpc("register_webhook_effect", {
      p_webhook_event_id: eventId,
      p_organization_id: organizationId,
      p_event_claim_token: eventClaimToken,
      p_effect_type: effectType,
      p_effect_key: effectKey,
      p_is_external: isExternal,
      p_request_hash: requestHash,
    })
    .single();

  if (error) throw error;
  return data;
}

export async function claimWebhookEffect({
  effectId,
  eventId,
  organizationId,
  eventClaimToken,
  workerId,
  leaseSeconds = 120,
}) {
  const { data, error } = await sb
    .rpc("claim_webhook_effect", {
      p_effect_id: effectId,
      p_webhook_event_id: eventId,
      p_organization_id: organizationId,
      p_event_claim_token: eventClaimToken,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function transitionWebhookEffect({
  effectId,
  eventId,
  organizationId,
  eventClaimToken,
  effectClaimToken,
  status,
  result = null,
  providerReference = null,
  lastError = null,
  nextAttemptAt = null,
}) {
  const { data, error } = await sb
    .rpc("transition_webhook_effect", {
      p_effect_id: effectId,
      p_webhook_event_id: eventId,
      p_organization_id: organizationId,
      p_event_claim_token: eventClaimToken,
      p_effect_claim_token: effectClaimToken,
      p_status: status,
      p_result: result,
      p_provider_reference: providerReference,
      p_last_error: lastError,
      p_next_attempt_at: nextAttemptAt,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function renewWebhookEffectLease({
  effectId,
  eventId,
  organizationId,
  eventClaimToken,
  effectClaimToken,
  leaseSeconds = 120,
}) {
  const { data, error } = await sb
    .rpc("renew_webhook_effect_lease", {
      p_effect_id: effectId,
      p_webhook_event_id: eventId,
      p_organization_id: organizationId,
      p_event_claim_token: eventClaimToken,
      p_effect_claim_token: effectClaimToken,
      p_lease_seconds: leaseSeconds,
    })
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
