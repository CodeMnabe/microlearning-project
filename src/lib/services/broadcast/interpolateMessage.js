const NAME_KEYS = [
  "name",
  "nome",
  "firstname",
  "first_name",
  "utilizador",
  "user",
  "user_name",
  "recipient_name",
];

const COMPANY_KEYS = [
  "empresa",
  "company",
  "organization",
  "organização",
  "organizacao",
  "org",
  "orgname",
  "companyname",
  "organizationname",
  "organization_name",
  "org_name",
  "company_name",
];

export function interpolateBroadcastMessage(str, ctx = {}) {
  if (!str) return "";

  const { user = null, org = null, assistant = null } = ctx;

  return String(str).replace(/\{\{\s*([.\w-]+)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey || "")
      .trim()
      .toLowerCase();

    if (NAME_KEYS.includes(key)) {
      return user?.name || "";
    }

    if (COMPANY_KEYS.includes(key)) {
      return org?.name || "";
    }

    switch (key) {
      case "user_email":
        return user?.email || "";
      case "user_phone":
        return user?.phone_number || "";
      case "assistant_name":
        return assistant?.name || "";
      default:
        return "";
    }
  });
}
