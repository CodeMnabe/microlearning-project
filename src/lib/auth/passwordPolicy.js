export const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  maxBytes: 128,
  requireLowercase: true,
  requireUppercase: true,
  requireDigit: true,
  requireSymbol: true,
});

export function validatePassword(password) {
  const errors = [];

  if (typeof password !== "string") {
    return ["password_invalid_type"];
  }

  if (password.trim().length === 0) {
    return ["password_empty"];
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push("password_too_short");
  }

  const encoder = new TextEncoder();
  if (encoder.encode(password).length > PASSWORD_POLICY.maxBytes) {
    errors.push("password_too_long");
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("password_missing_lowercase");
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("password_missing_uppercase");
  }

  if (PASSWORD_POLICY.requireDigit && !/\d/.test(password)) {
    errors.push("password_missing_digit");
  }

  if (PASSWORD_POLICY.requireSymbol && !/[^a-zA-Z0-9\s]/.test(password)) {
    errors.push("password_missing_symbol");
  }

  return errors;
}

export function validatePasswordWithConfirmation(password, confirmation) {
  const errors = validatePassword(password);

  if (password !== confirmation) {
    errors.push("password_confirmation_mismatch");
  }

  return errors;
}
