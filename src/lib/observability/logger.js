import "server-only";
import { types as utilTypes } from "node:util";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_ERROR_CODE_MAP = Object.freeze({
  ETIMEDOUT: Object.freeze({
    errorType: "timeout_error",
    errorCode: "timeout",
  }),
  ECONNABORTED: Object.freeze({
    errorType: "timeout_error",
    errorCode: "timeout",
  }),
  ECONNRESET: Object.freeze({
    errorType: "connection_error",
    errorCode: "connection_reset",
  }),
  ABORT_ERR: Object.freeze({
    errorType: "aborted_error",
    errorCode: "aborted",
  }),
});

const SAFE_ERROR_NAME_MAP = Object.freeze({
  AbortError: Object.freeze({
    errorType: "aborted_error",
    errorCode: "aborted",
  }),
  TypeError: Object.freeze({ errorType: "type_error" }),
  RangeError: Object.freeze({ errorType: "range_error" }),
});

const SAFE_ERROR_TYPES = Object.freeze([
  "unknown_error",
  "timeout_error",
  "connection_error",
  "aborted_error",
  "type_error",
  "range_error",
  "http_error",
]);

const SAFE_ERROR_CODES = Object.freeze([
  "timeout",
  "connection_reset",
  "aborted",
]);

function enumRule(values) {
  return Object.freeze({
    type: "enum",
    values: Object.freeze([...new Set(values)]),
  });
}

const FIELD_RULES = Object.freeze({
  organizationId: Object.freeze({ type: "positive_integer" }),
  assistantId: Object.freeze({ type: "positive_integer" }),
  userId: Object.freeze({ type: "positive_integer" }),
  fileId: Object.freeze({ type: "positive_integer" }),
  broadcastId: Object.freeze({ type: "uuid" }),
  chainId: Object.freeze({ type: "uuid" }),
  runId: Object.freeze({ type: "uuid" }),
  reservationId: Object.freeze({ type: "uuid" }),
  deliveryId: Object.freeze({ type: "uuid" }),
  pendingOutreachId: Object.freeze({ type: "uuid" }),
  statusCode: Object.freeze({ type: "http_status" }),
  durationMs: Object.freeze({ type: "non_negative_integer" }),
  attempt: Object.freeze({ type: "non_negative_integer" }),
  count: Object.freeze({ type: "non_negative_integer" }),
  batchSize: Object.freeze({ type: "non_negative_integer" }),
  stepIndex: Object.freeze({ type: "non_negative_integer" }),
  claimed: Object.freeze({ type: "non_negative_integer" }),
  processed: Object.freeze({ type: "non_negative_integer" }),
  succeeded: Object.freeze({ type: "non_negative_integer" }),
  failed: Object.freeze({ type: "non_negative_integer" }),
  skipped: Object.freeze({ type: "non_negative_integer" }),
  sent: Object.freeze({ type: "non_negative_integer" }),
  partial: Object.freeze({ type: "non_negative_integer" }),
  unknownOutcome: Object.freeze({ type: "non_negative_integer" }),
  retryableFailed: Object.freeze({ type: "non_negative_integer" }),
  retryable: Object.freeze({ type: "boolean" }),
  found: Object.freeze({ type: "boolean" }),
  externalRequestStarted: Object.freeze({ type: "boolean" }),
});

const ERROR_FIELD_RULES = Object.freeze({
  errorType: enumRule(SAFE_ERROR_TYPES),
  errorCode: enumRule(SAFE_ERROR_CODES),
  statusCode: FIELD_RULES.statusCode,
  retryable: FIELD_RULES.retryable,
});

function defineEvent({
  providers,
  operations,
  outcomes,
  statuses = null,
  channels = null,
  fields = [],
  error = false,
}) {
  const schema = Object.create(null);
  schema.provider = enumRule(providers);
  schema.operation = enumRule(operations);
  schema.outcome = enumRule(outcomes);

  if (statuses) schema.status = enumRule(statuses);
  if (channels) schema.channel = enumRule(channels);

  for (const field of fields) {
    if (Object.hasOwn(FIELD_RULES, field)) schema[field] = FIELD_RULES[field];
  }

  if (error) {
    for (const [field, rule] of Object.entries(ERROR_FIELD_RULES)) {
      if (!Object.hasOwn(schema, field)) schema[field] = rule;
    }
  }

  return Object.freeze(schema);
}

export const EVENT_SCHEMAS = Object.freeze({
  analytics_query_failed: defineEvent({
    providers: ["supabase"],
    operations: ["metric_fallback"],
    outcomes: ["fallback"],
    error: true,
  }),
  api_request_failed: defineEvent({
    providers: ["internal"],
    operations: ["api_handler"],
    outcomes: ["failed"],
    fields: ["statusCode"],
    error: true,
  }),
  assistant_not_found: defineEvent({
    providers: ["supabase"],
    operations: ["inbound_assistant_lookup"],
    outcomes: ["not_found"],
    fields: ["organizationId"],
  }),
  authorization_lookup_failed: defineEvent({
    providers: ["supabase"],
    operations: [
      "organization_lookup",
      "user_lookup",
      "assistant_lookup",
      "tag_lookup",
      "scheduled_broadcast_lookup",
      "thread_lookup",
      "thread_user_lookup",
      "thread_assistant_lookup",
      "automation_rule_lookup",
      "template_authorization_lookup",
    ],
    outcomes: ["failed"],
    fields: ["organizationId", "userId", "assistantId", "broadcastId"],
    error: true,
  }),
  automation_event_emit_failed: defineEvent({
    providers: ["internal"],
    operations: ["user_created_event"],
    outcomes: ["failed"],
    fields: ["organizationId", "userId", "assistantId"],
    error: true,
  }),
  automation_inactivity_processing_failed: defineEvent({
    providers: ["internal"],
    operations: ["automation_inactivity_batch"],
    outcomes: ["failed"],
    error: true,
  }),
  automation_materialization_batch_failed: defineEvent({
    providers: ["supabase"],
    operations: ["automation_materialization_batch"],
    outcomes: ["failed"],
    error: true,
  }),
  automation_materialization_batch_started: defineEvent({
    providers: ["supabase"],
    operations: ["automation_materialization_batch"],
    outcomes: ["started"],
    fields: ["count", "batchSize"],
  }),
  automation_materialization_completed: defineEvent({
    providers: ["supabase"],
    operations: ["automation_materialization"],
    outcomes: ["materialized"],
    channels: ["whatsapp", "teams"],
    fields: ["runId", "broadcastId", "organizationId", "userId"],
  }),
  automation_materialization_failed: defineEvent({
    providers: ["supabase"],
    operations: ["automation_materialization"],
    outcomes: ["failed"],
    channels: ["whatsapp", "teams"],
    fields: ["runId", "broadcastId", "organizationId", "userId"],
    error: true,
  }),
  automation_materialization_skipped: defineEvent({
    providers: ["supabase"],
    operations: ["automation_materialization"],
    outcomes: [
      "already_materialized",
      "claim_lost",
      "not_due",
      "not_found",
      "organization_mismatch",
    ],
    fields: ["runId", "broadcastId"],
  }),
  automation_run_failure_persistence_failed: defineEvent({
    providers: ["supabase"],
    operations: ["automation_run_failure_update"],
    outcomes: ["failed"],
    fields: ["runId"],
    error: true,
  }),
  automation_unread_processing_failed: defineEvent({
    providers: ["internal"],
    operations: ["automation_unread_batch"],
    outcomes: ["failed"],
    error: true,
  }),
  broadcast_delivery_attempted: defineEvent({
    providers: ["teams", "bird"],
    operations: ["broadcast_send", "template_send"],
    outcomes: ["prepared"],
    fields: ["broadcastId", "userId", "count"],
  }),
  broadcast_delivery_completed: defineEvent({
    providers: ["teams", "bird"],
    operations: ["broadcast_send", "freeform_send", "template_send"],
    outcomes: ["succeeded", "failed"],
    fields: ["statusCode", "broadcastId", "userId", "reservationId"],
  }),
  broadcast_delivery_failed: defineEvent({
    providers: ["teams", "bird"],
    operations: ["broadcast_send"],
    outcomes: ["failed"],
    fields: ["broadcastId", "userId"],
    error: true,
  }),
  contact_submission_failed: defineEvent({
    providers: ["supabase"],
    operations: ["contact_create"],
    outcomes: ["failed"],
    error: true,
  }),
  public_abuse_cleanup_completed: defineEvent({
    providers: ["supabase"],
    operations: ["public_abuse_cleanup"],
    outcomes: ["completed"],
    fields: ["processed"],
  }),
  public_abuse_cleanup_failed: defineEvent({
    providers: ["supabase"],
    operations: ["public_abuse_cleanup"],
    outcomes: ["failed"],
    error: true,
  }),
  file_cleanup_compensation_failed: defineEvent({
    providers: ["supabase"],
    operations: ["public_image_delete"],
    outcomes: ["failed"],
    fields: ["fileId", "organizationId"],
    error: true,
  }),
  file_cleanup_completed: defineEvent({
    providers: ["internal"],
    operations: ["file_cleanup_batch"],
    outcomes: ["completed"],
    fields: ["processed", "succeeded", "failed"],
  }),
  file_cleanup_failed: defineEvent({
    providers: ["internal"],
    operations: ["file_cleanup_batch"],
    outcomes: ["failed"],
    error: true,
  }),
  inbound_identity_missing: defineEvent({
    providers: ["bird"],
    operations: ["inbound_message"],
    outcomes: ["missing_channel_id", "missing_user_identity"],
  }),
  local_persistence_read_failed: defineEvent({
    providers: ["filesystem"],
    operations: ["local_database_read"],
    outcomes: ["failed"],
    error: true,
  }),
  message_chain_delivery_state_failed: defineEvent({
    providers: ["supabase"],
    operations: ["delivery_unknown_outcome_update"],
    outcomes: ["failed"],
    fields: ["deliveryId"],
    error: true,
  }),
  openai_operation_completed: defineEvent({
    providers: ["openai"],
    operations: [
      "assistant_delete",
      "vector_store_create",
      "vector_store_association",
    ],
    outcomes: ["succeeded", "not_deleted", "not_updated"],
    fields: ["count"],
  }),
  openai_operation_failed: defineEvent({
    providers: ["openai"],
    operations: [
      "assistant_create",
      "assistant_retrieve",
      "assistant_update",
      "assistant_delete",
      "file_upload",
      "vector_store_create",
      "vector_store_association",
      "message_run",
    ],
    outcomes: ["failed"],
    fields: ["assistantId", "organizationId"],
    error: true,
  }),
  openai_operation_rejected: defineEvent({
    providers: ["openai"],
    operations: ["vector_store_create"],
    outcomes: ["invalid_input"],
  }),
  organization_not_found: defineEvent({
    providers: ["supabase"],
    operations: [
      "read_interaction_organization_lookup",
      "webhook_organization_lookup",
      "inbound_user_organization_lookup",
      "pending_outreach_organization_lookup",
    ],
    outcomes: ["not_found"],
    fields: ["organizationId", "userId"],
  }),
  organization_resolution_failed: defineEvent({
    providers: ["supabase"],
    operations: [
      "read_interaction_organization_lookup",
      "webhook_organization_lookup",
    ],
    outcomes: ["failed"],
    error: true,
  }),
  pending_outreach_chain_state_failed: defineEvent({
    providers: ["supabase"],
    operations: ["pending_outreach_chain_update"],
    outcomes: ["failed"],
    fields: ["pendingOutreachId", "chainId", "stepIndex"],
    error: true,
  }),
  pending_outreach_chain_state_updated: defineEvent({
    providers: ["supabase"],
    operations: ["pending_outreach_chain_update"],
    outcomes: ["succeeded"],
    fields: ["pendingOutreachId", "chainId", "stepIndex"],
  }),
  pending_outreach_failure_persistence_failed: defineEvent({
    providers: ["bird"],
    operations: ["template_reservation_failure"],
    outcomes: ["failed"],
    fields: ["pendingOutreachId"],
    error: true,
  }),
  pending_outreach_skipped: defineEvent({
    providers: ["internal"],
    operations: ["pending_outreach_send"],
    outcomes: ["empty"],
    fields: ["pendingOutreachId", "userId"],
  }),
  provider_authentication_failed: defineEvent({
    providers: ["teams"],
    operations: ["bot_token_acquisition"],
    outcomes: ["failed"],
    error: true,
  }),
  provider_request_failed: defineEvent({
    providers: ["teams", "bird"],
    operations: [
      "reply_send",
      "projects_list",
      "read_interactions_list",
      "template_lookup",
      "template_send",
    ],
    outcomes: ["failed", "rejected"],
    fields: ["statusCode", "organizationId", "retryable"],
  }),
  read_chain_delivery_failed: defineEvent({
    providers: ["internal"],
    operations: ["delayed_step_delivery"],
    outcomes: ["failed"],
    fields: ["deliveryId", "chainId"],
    error: true,
  }),
  read_chain_processed: defineEvent({
    providers: ["internal"],
    operations: ["read_interaction_chain_advance"],
    outcomes: ["completed"],
    fields: ["chainId", "stepIndex"],
  }),
  read_chain_processing_failed: defineEvent({
    providers: ["internal"],
    operations: [
      "read_chain_process_read",
      "delayed_steps_batch",
      "read_chains_batch",
      "read_interaction_chain_advance",
    ],
    outcomes: ["failed"],
    fields: ["chainId", "stepIndex"],
    error: true,
  }),
  read_interaction_invalid: defineEvent({
    providers: ["bird"],
    operations: ["read_interaction"],
    outcomes: ["missing_message_id", "missing_channel_id"],
  }),
  read_interaction_unmatched: defineEvent({
    providers: ["supabase"],
    operations: ["read_receipt_update"],
    outcomes: ["not_found"],
    fields: ["organizationId"],
  }),
  read_receipt_sync_failed: defineEvent({
    providers: ["internal", "bird"],
    operations: ["read_receipt_sync_batch", "read_receipt_sync"],
    outcomes: ["failed"],
    error: true,
  }),
  scheduled_broadcast_batch_completed: defineEvent({
    providers: ["internal"],
    operations: ["scheduled_broadcast_batch"],
    outcomes: ["completed"],
    fields: ["claimed", "sent", "partial", "retryableFailed", "unknownOutcome"],
  }),
  scheduled_broadcast_delivery_failed: defineEvent({
    providers: ["bird", "teams"],
    operations: ["scheduled_broadcast_send"],
    outcomes: ["unknown_outcome", "retryable_failed"],
    fields: ["broadcastId", "organizationId", "externalRequestStarted"],
    error: true,
  }),
  scheduled_broadcast_finalization_failed: defineEvent({
    providers: ["supabase"],
    operations: ["scheduled_broadcast_finalization"],
    outcomes: ["failed"],
    fields: ["broadcastId", "organizationId"],
    error: true,
  }),
  scheduled_broadcast_processed: defineEvent({
    providers: ["bird", "teams"],
    operations: ["scheduled_broadcast_send"],
    outcomes: ["sent", "partial", "unknown_outcome"],
    fields: ["broadcastId", "organizationId", "succeeded", "failed"],
  }),
  scheduled_broadcast_processing_failed: defineEvent({
    providers: ["internal"],
    operations: ["scheduled_broadcast_batch"],
    outcomes: ["failed"],
    error: true,
  }),
  teams_conversation_lookup_completed: defineEvent({
    providers: ["supabase"],
    operations: ["teams_conversation_lookup"],
    outcomes: ["found", "not_found"],
    fields: ["userId", "found"],
  }),
  teams_conversation_lookup_failed: defineEvent({
    providers: ["supabase"],
    operations: ["teams_conversation_lookup"],
    outcomes: ["failed"],
    fields: ["userId"],
    error: true,
  }),
  teams_installation_invalid: defineEvent({
    providers: ["teams"],
    operations: ["personal_installation", "group_installation"],
    outcomes: ["missing_required_fields"],
  }),
  teams_installation_persisted: defineEvent({
    providers: ["supabase"],
    operations: ["teams_installation_upsert"],
    outcomes: ["succeeded"],
    fields: ["organizationId", "assistantId", "userId"],
  }),
  teams_installation_persistence_failed: defineEvent({
    providers: ["supabase"],
    operations: ["teams_installation_upsert"],
    outcomes: ["failed"],
    fields: ["organizationId", "assistantId", "userId"],
    error: true,
  }),
  teams_message_received: defineEvent({
    providers: ["teams"],
    operations: ["command_dispatch"],
    outcomes: ["command_detected"],
  }),
  teams_organization_mismatch: defineEvent({
    providers: ["teams"],
    operations: ["user_organization_check"],
    outcomes: ["rejected"],
    fields: ["organizationId", "userId"],
  }),
  teams_user_sync_failed: defineEvent({
    providers: ["teams"],
    operations: ["user_identity_sync"],
    outcomes: ["failed"],
    fields: ["userId"],
    error: true,
  }),
  tracked_link_resolution_failed: defineEvent({
    providers: ["internal"],
    operations: ["tracked_link_resolve", "tracked_link_interaction"],
    outcomes: ["failed"],
    error: true,
  }),
  user_identity_lookup_ambiguous: defineEvent({
    providers: ["supabase"],
    operations: ["user_identity_lookup"],
    outcomes: ["ambiguous"],
    fields: ["count"],
  }),
  webhook_identity_conflict: defineEvent({
    providers: ["bird"],
    operations: ["webhook_registration"],
    outcomes: ["payload_conflict"],
    statuses: [
      "received",
      "processing",
      "succeeded",
      "retryable_failed",
      "unknown_outcome",
      "failed",
      "conflict",
    ],
  }),
  webhook_processing_failed: defineEvent({
    providers: ["internal", "bird"],
    operations: ["webhook_event_batch", "webhook_registration"],
    outcomes: ["failed"],
    fields: ["statusCode"],
    error: true,
  }),
  webhook_validation_failed: defineEvent({
    providers: ["bird", "teams"],
    operations: [
      "timestamp_validation",
      "host_validation",
      "signature_validation",
      "request_authentication",
    ],
    outcomes: ["rejected"],
    error: true,
  }),
});

export const ALLOWED_LOG_FIELDS = Object.freeze(
  Array.from(
    new Set(
      Object.values(EVENT_SCHEMAS).flatMap((schema) => Object.keys(schema)),
    ),
  ).sort(),
);

function isProxy(value) {
  try {
    return utilTypes.isProxy(value);
  } catch {
    return true;
  }
}

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || isProxy(value)) return false;

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataValue(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function sanitizeByRule(value, rule) {
  if (!rule) return undefined;

  if (rule.type === "enum") {
    return typeof value === "string" && rule.values.includes(value)
      ? value
      : undefined;
  }

  if (rule.type === "positive_integer") {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? value
      : undefined;
  }

  if (rule.type === "uuid") {
    return typeof value === "string" && UUID_PATTERN.test(value)
      ? value.toLowerCase()
      : undefined;
  }

  if (rule.type === "non_negative_integer") {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : undefined;
  }

  if (rule.type === "http_status") {
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 100 &&
      value <= 599
      ? value
      : undefined;
  }

  if (rule.type === "boolean") {
    return typeof value === "boolean" ? value : undefined;
  }

  return undefined;
}

export function sanitizeLogFields(event, fields) {
  try {
    if (
      typeof event !== "string" ||
      !Object.hasOwn(EVENT_SCHEMAS, event) ||
      !isPlainRecord(fields)
    ) {
      return {};
    }

    const schema = EVENT_SCHEMAS[event];
    const result = Object.create(null);

    for (const [field, rule] of Object.entries(schema)) {
      const rawValue = ownDataValue(fields, field);
      const safeValue = sanitizeByRule(rawValue, rule);
      if (safeValue !== undefined) result[field] = safeValue;
    }

    return result;
  } catch {
    return {};
  }
}

function isSupportedErrorObject(error) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return false;
  }
  if (isProxy(error)) return false;

  try {
    const prototype = Object.getPrototypeOf(error);
    return (
      prototype === Object.prototype ||
      prototype === null ||
      prototype === Error.prototype ||
      prototype === TypeError.prototype ||
      prototype === RangeError.prototype
    );
  } catch {
    return false;
  }
}

export function classifyLogError(error, schema = ERROR_FIELD_RULES) {
  try {
    if (error === undefined || error === null) return {};

    const result = Object.create(null);
    result.errorType = "unknown_error";

    if (isSupportedErrorObject(error)) {
      const code = ownDataValue(error, "code");
      const name = ownDataValue(error, "name");
      const statusCode = ownDataValue(error, "statusCode");
      const status = ownDataValue(error, "status");
      const retryable = ownDataValue(error, "retryable");

      const mappedCode =
        typeof code === "string" && Object.hasOwn(SAFE_ERROR_CODE_MAP, code)
          ? SAFE_ERROR_CODE_MAP[code]
          : null;
      const mappedName =
        typeof name === "string" && Object.hasOwn(SAFE_ERROR_NAME_MAP, name)
          ? SAFE_ERROR_NAME_MAP[name]
          : null;
      const classification = mappedCode || mappedName;

      if (classification) Object.assign(result, classification);

      const safeStatusCode = sanitizeByRule(
        statusCode === undefined ? status : statusCode,
        ERROR_FIELD_RULES.statusCode,
      );
      if (safeStatusCode !== undefined) {
        result.statusCode = safeStatusCode;
        if (!classification) result.errorType = "http_error";
      }

      if (typeof retryable === "boolean") result.retryable = retryable;
    }

    const filtered = Object.create(null);
    for (const [field, value] of Object.entries(result)) {
      if (!Object.hasOwn(schema, field)) continue;
      const safeValue = sanitizeByRule(value, schema[field]);
      if (safeValue !== undefined) filtered[field] = safeValue;
    }
    return filtered;
  } catch {
    return Object.hasOwn(schema, "errorType")
      ? { errorType: "unknown_error" }
      : {};
  }
}

function defaultSink(serialized, level) {
  const method = console[level] || console.log;
  method(serialized);
}

export function createLogger({
  environment = process.env.NODE_ENV || "development",
  sink = defaultSink,
  now = () => new Date().toISOString(),
} = {}) {
  function write(level, event, fields = {}, error = undefined) {
    try {
      if (typeof event !== "string" || !Object.hasOwn(EVENT_SCHEMAS, event)) {
        return false;
      }

      const schema = EVENT_SCHEMAS[event];
      const entry = {
        level,
        event,
        ...sanitizeLogFields(event, fields),
        ...classifyLogError(error, schema),
      };

      if (environment !== "test") {
        const timestamp = now();
        if (typeof timestamp !== "string") return false;
        entry.timestamp = timestamp;
      }

      const serialized = JSON.stringify(entry);
      if (typeof serialized !== "string") return false;
      sink(serialized, level);
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields, error) => write("warn", event, fields, error),
    error: (event, fields, error) => write("error", event, fields, error),
  });
}

export const logger = createLogger();
