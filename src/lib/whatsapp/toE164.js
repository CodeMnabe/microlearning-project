require("dotenv").config();

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
