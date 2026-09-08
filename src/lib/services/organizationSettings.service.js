import phoneCountryCodes from "@/messages/phoneCountryCodes.json";
import { isValidHexColor } from "@/lib/helpers/theme.helpers";
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/lib/repos/organizationSettings.repo";

export const ORGANIZATION_SETTINGS_FIELDS = Object.freeze([
  "name",
  "default_phone_country_code",
  "theme",
  "teams_tenant_id",
  "waba_id",
  "waba_namespace",
]);

const COUNTRY_CODES = new Set(phoneCountryCodes.map(({ code }) => code));

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeOptionalText(value, field) {
  if (typeof value !== "string") {
    throw validationError(`${field} must be a string`);
  }

  return value.trim() || null;
}

export function normalizeOrganizationSettingsPatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Settings body must be an object");
  }

  const patch = {};

  if (hasOwn(input, "name")) {
    if (typeof input.name !== "string") {
      throw validationError("name must be a string");
    }

    const name = input.name.trim();
    if (!name) throw validationError("name is required");
    if (name.length > 150) {
      throw validationError("name must not exceed 150 characters");
    }

    patch.name = name;
  }

  if (hasOwn(input, "default_phone_country_code")) {
    const value = input.default_phone_country_code;
    if (typeof value !== "string" || !COUNTRY_CODES.has(value.trim())) {
      throw validationError("default_phone_country_code is not supported");
    }

    patch.default_phone_country_code = value.trim();
  }

  if (hasOwn(input, "theme")) {
    const theme = input.theme;
    if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
      throw validationError("theme must be an object");
    }

    if (!hasOwn(theme, "primary") || !hasOwn(theme, "secondary")) {
      throw validationError("theme must include primary and secondary colors");
    }

    if (
      !isValidHexColor(theme.primary) ||
      !isValidHexColor(theme.secondary)
    ) {
      throw validationError("theme colors must be valid hexadecimal colors");
    }

    patch.theme = {
      primary: theme.primary,
      secondary: theme.secondary,
    };
  }

  for (const field of ["teams_tenant_id", "waba_id", "waba_namespace"]) {
    if (hasOwn(input, field)) {
      patch[field] = normalizeOptionalText(input[field], field);
    }
  }

  if (Object.keys(patch).length === 0) {
    throw validationError("No supported settings fields were provided");
  }

  return patch;
}

export async function loadOrganizationSettings(orgId) {
  return getOrganizationSettings(orgId);
}

export async function saveOrganizationSettings(orgId, input) {
  const patch = normalizeOrganizationSettingsPatch(input);

  try {
    return await updateOrganizationSettings(orgId, patch);
  } catch (error) {
    if (error?.code === "23505") {
      const conflict = new Error(
        "This Microsoft Teams tenant ID is already assigned to another organization.",
      );
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }
}
