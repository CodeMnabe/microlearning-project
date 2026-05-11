export const NAME_KEYS = [
  "name",
  "nome",
  "firstname",
  "first_name",
  "utilizador",
  "user",
];

export const COMPANY_KEYS = [
  "empresa",
  "company",
  "organization",
  "organização",
  "organizacao",
  "org",
  "orgname",
  "companyname",
  "organizationname",
];

export const STATUS_RANK = {
  ACTIVE: 4,
  PENDING: 3,
  PENDINGREVIEW: 3,
  DRAFT: 2,
  INACTIVE: 1,
};

export const isLockedVar = (key) => {
  const k = String(key || "").toLowerCase();
  return NAME_KEYS.includes(k) || COMPANY_KEYS.includes(k);
};
