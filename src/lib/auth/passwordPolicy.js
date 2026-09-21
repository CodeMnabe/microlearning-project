export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordAllowed(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    /\p{Lu}/u.test(password) &&
    /\p{Ll}/u.test(password) &&
    /[^\p{L}\p{N}]/u.test(password)
  );
}
