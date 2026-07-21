const parsePositiveInteger = (value, fallback, hardMaximum) => {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > hardMaximum) {
    return fallback;
  }
  return parsed;
};

export const IMMEDIATE_BROADCAST_RECIPIENT_LIMIT = parsePositiveInteger(
  process.env.IMMEDIATE_BROADCAST_RECIPIENT_LIMIT,
  500,
  500,
);
export const WHATSAPP_BROADCAST_CONCURRENCY = parsePositiveInteger(
  process.env.WHATSAPP_BROADCAST_CONCURRENCY,
  10,
  10,
);
export const TEAMS_BROADCAST_CONCURRENCY = parsePositiveInteger(
  process.env.TEAMS_BROADCAST_CONCURRENCY,
  5,
  5,
);
export const IMMEDIATE_BROADCAST_LEASE_SECONDS = 120;
export const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
export const IDEMPOTENCY_KEY_MAX_BYTES = 128;
export const IMMEDIATE_BROADCAST_RESULT_MAX_BYTES = 8192;
