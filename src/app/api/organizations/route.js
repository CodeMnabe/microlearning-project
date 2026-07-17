import { NextResponse } from "next/server";
import { updateOrganizationProfile } from "@/lib/repos/organizations.repo";
import {
  handleApiError,
  requireOwnedOrg,
  requireUser,
} from "@/lib/auth/guards";

const PROFILE_FIELDS = new Set([
  "name",
  "theme",
  "logo_url",
  "default_phone_country_code",
]);

const PROFILE_REQUEST_FIELDS = new Set([
  "organizationId",
  ...PROFILE_FIELDS,
]);

const HEX_COLOR = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidField(field, message) {
  return NextResponse.json(
    { error: `Invalid field \u00ab${field}\u00bb. ${message}` },
    { status: 400 },
  );
}

export async function POST(request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    if (!isPlainObject(body)) {
      return NextResponse.json(
        { error: "JSON body must be an object." },
        { status: 400 },
      );
    }

    if (Object.hasOwn(body, "channelId") || Object.hasOwn(body, "channel_id")) {
      return NextResponse.json(
        {
          error:
            "channel_id is assigned only by verified backend provisioning.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Organization creation requires verified backend Bird provisioning.",
      },
      { status: 403 },
    );
  } catch (err) {
    return handleApiError(
      err,
      "Internal error. Check Server Logs",
    );
  }
}

export async function PATCH(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    if (!isPlainObject(body)) {
      return NextResponse.json(
        { error: "JSON body must be an object." },
        { status: 400 },
      );
    }

    const unknownFields = Object.keys(body).filter(
      (field) => !PROFILE_REQUEST_FIELDS.has(field),
    );

    if (unknownFields.length) {
      return NextResponse.json(
        { error: `Unknown field: ${unknownFields[0]}.` },
        { status: 400 },
      );
    }

    const requestedProfileFields = Object.keys(body).filter((field) =>
      PROFILE_FIELDS.has(field),
    );

    if (!requestedProfileFields.length) {
      return NextResponse.json(
        { error: "At least one self-service field is required." },
        { status: 400 },
      );
    }

    const orgAuth = await requireOwnedOrg(body.organizationId);
    if (orgAuth.error) return orgAuth.error;

    const patch = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return invalidField("name", "A non-empty string is required.");
      }

      const name = body.name.trim();
      if (name.length > 150) {
        return invalidField("name", "Maximum length is 150 characters.");
      }

      patch.name = name;
    }

    if (Object.hasOwn(body, "theme")) {
      if (!isPlainObject(body.theme)) {
        return invalidField("theme", "An object is required.");
      }

      const themeKeys = Object.keys(body.theme);
      const validThemeKeys = new Set(["primary", "secondary"]);

      if (
        themeKeys.length !== 2 ||
        themeKeys.some((key) => !validThemeKeys.has(key)) ||
        !HEX_COLOR.test(body.theme.primary) ||
        !HEX_COLOR.test(body.theme.secondary)
      ) {
        return invalidField(
          "theme",
          "Exactly primary and secondary hex colors are required.",
        );
      }

      patch.theme = {
        primary: body.theme.primary,
        secondary: body.theme.secondary,
      };
    }

    if (Object.hasOwn(body, "logo_url")) {
      if (body.logo_url !== null && typeof body.logo_url !== "string") {
        return invalidField("logo_url", "A string or null is required.");
      }

      const logoUrl = body.logo_url === null ? null : body.logo_url.trim();
      if (logoUrl && logoUrl.length > 2048) {
        return invalidField("logo_url", "Maximum length is 2048 characters.");
      }

      patch.logo_url = logoUrl || null;
    }

    if (Object.hasOwn(body, "default_phone_country_code")) {
      if (
        typeof body.default_phone_country_code !== "string" ||
        !/^\+\d{1,4}$/.test(body.default_phone_country_code.trim())
      ) {
        return invalidField(
          "default_phone_country_code",
          "Use a plus sign followed by 1 to 4 digits.",
        );
      }

      patch.default_phone_country_code =
        body.default_phone_country_code.trim();
    }

    const org = await updateOrganizationProfile(orgAuth.orgId, patch);

    return NextResponse.json({ org });
  } catch (err) {
    return handleApiError(err, "Failed to update organization profile");
  }
}
