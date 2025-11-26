export async function toE164(
  raw,
  defaultCc = process.env.DEFAULT_COUNTRY_CODE || "+351"
) {
  if (!raw) return null;
  const s = String(raw).replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  return `${defaultCc}${s.startsWith("0") ? s.slice(1) : s}`;
}

/**
 * Splits a valid E.164 phone number into its country code and national number
 *
 * @param {string} e164 - A phone number in the E.164 format
 * @returns {{ countryCode: string, nationalNumber: string}} Parsed country code and national number
 * @throws {Error} If the input is not a valid E.164 number or cannot be split
 */

export async function splitE164(e164) {
  if (!/^\+\d{6,15}$/.test(e164)) {
    throw new Error("Invalid E.164 number: " + e164);
  }

  for (let ccLen = 3; ccLen >= 1; ccLen--) {
    const countryCode = e164.slice(0, 1 + ccLen);
    const national = e164.slice(1 + ccLen);

    if (national.length >= 6) {
      return { countryCode, nationalNumber: national };
    }
  }

  throw new Error("Unable to split E.164 number: " + e164);
}
