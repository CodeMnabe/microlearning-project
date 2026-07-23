import { CONTACT_FIELDS } from "@/lib/limits/publicAbuse";

const ALLOWED_FIELDS = new Set(Object.keys(CONTACT_FIELDS));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_UNICODE =
  /[\u0000\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const FORBIDDEN_SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f-\u009f]/u;
const FORBIDDEN_MESSAGE_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

export class ContactValidationError extends Error {
  constructor() {
    super("invalid_contact_submission");
    this.name = "ContactValidationError";
    this.status = 400;
  }
}

function cleanField(
  value,
  field,
  { optional = false, multiline = false } = {},
) {
  if (typeof value !== "string") throw new ContactValidationError();
  const normalized = value.normalize("NFC").trim();
  const limits = CONTACT_FIELDS[field];
  if (optional && normalized.length === 0) return null;
  if (normalized.length < limits.min || normalized.length > limits.max) {
    throw new ContactValidationError();
  }
  if (
    FORBIDDEN_UNICODE.test(normalized) ||
    (multiline
      ? FORBIDDEN_MESSAGE_CONTROLS.test(normalized)
      : FORBIDDEN_SINGLE_LINE_CONTROLS.test(normalized))
  ) {
    throw new ContactValidationError();
  }
  return normalized;
}

export function validateContactSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ContactValidationError();
  }
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw new ContactValidationError();
  }

  const name = cleanField(body.name, "name");
  const email = cleanField(body.email, "email").toLowerCase();
  const company = cleanField(body.company ?? "", "company", { optional: true });
  const message = cleanField(body.message, "message", { multiline: true });
  const captchaToken = cleanField(body.captchaToken, "captchaToken");
  if (!EMAIL_PATTERN.test(email)) throw new ContactValidationError();

  return { name, email, company, message, captchaToken };
}
