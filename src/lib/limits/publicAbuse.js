export const CONTACT_BODY_MAX_BYTES = 16 * 1024;

export const CONTACT_FIELDS = Object.freeze({
  name: Object.freeze({ min: 2, max: 120 }),
  email: Object.freeze({ min: 3, max: 254 }),
  company: Object.freeze({ min: 0, max: 160 }),
  message: Object.freeze({ min: 10, max: 4000 }),
  captchaToken: Object.freeze({ min: 1, max: 2048 }),
});

export const CONTACT_RATE_LIMITS = Object.freeze({
  global: Object.freeze({ windowSeconds: 60, maximumRequests: 120 }),
  ip: Object.freeze({ windowSeconds: 600, maximumRequests: 5 }),
  email: Object.freeze({ windowSeconds: 3600, maximumRequests: 3 }),
});

export const CONTACT_DEDUPE_WINDOW_SECONDS = 600;

export const TRACKED_LINK_HARD_MAX_TTL_SECONDS = 90 * 24 * 60 * 60;
export const TRACKED_LINK_CONTEXT_TTL_SECONDS = 5 * 60;
export const TRACKED_LINK_DEDUPE_WINDOW_SECONDS = 30 * 60;

export const TRACKED_LINK_RATE_LIMITS = Object.freeze({
  probingGlobal: Object.freeze({ windowSeconds: 60, maximumRequests: 5000 }),
  token: Object.freeze({ windowSeconds: 60, maximumRequests: 120 }),
  visitor: Object.freeze({ windowSeconds: 60, maximumRequests: 60 }),
  analyticsGlobal: Object.freeze({ windowSeconds: 60, maximumRequests: 2000 }),
  analyticsToken: Object.freeze({ windowSeconds: 60, maximumRequests: 30 }),
  analyticsVisitor: Object.freeze({ windowSeconds: 60, maximumRequests: 20 }),
});

export const PUBLIC_ABUSE_CLEANUP_MAX_BATCH = 1000;
