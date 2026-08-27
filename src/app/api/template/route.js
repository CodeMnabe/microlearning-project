import { NextResponse } from "next/server";
import {
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";

const BIRD = "https://api.bird.com";
const { BIRD_API_KEY, WORKSPACE_ID } = process.env;

function parseUuid(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  const isValid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    );

  return isValid ? normalized : null;
}

async function fetchBirdJson(path) {
  const response = await fetch(`${BIRD}${path}`, {
    headers: {
      Authorization: `AccessKey ${BIRD_API_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();

  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

async function fetchAllProjects() {
  let nextPageToken = null;
  const projects = [];

  do {
    const url = new URL(
      `${BIRD}/workspaces/${encodeURIComponent(
        WORKSPACE_ID,
      )}/projects`,
    );

    url.searchParams.set("limit", "100");
    url.searchParams.set("reverse", "true");

    if (nextPageToken) {
      url.searchParams.set(
        "pageToken",
        nextPageToken,
      );
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `AccessKey ${BIRD_API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const json = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      console.error(
        "[template] Failed to load Bird projects",
        {
          status: response.status,
          body: json,
        },
      );

      const error = new Error(
        "Messaging provider request failed",
      );

      error.status = 502;
      throw error;
    }

    projects.push(...(json?.results || []));
    nextPageToken =
      json?.nextPageToken || null;
  } while (nextPageToken);

  return projects;
}

async function requireTemplateForOrganization(
  admin,
  organizationId,
  providerTemplateId,
) {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .select(
      "id, org_id, provider_template_id",
    )
    .eq(
      "provider_template_id",
      providerTemplateId,
    )
    .eq("org_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(
      "[template] Template authorization lookup failed",
      error,
    );

    const authError = new Error(
      "Authorization check failed",
    );

    authError.status = 500;
    throw authError;
  }

  return data || null;
}

async function findTemplateInBird(
  channelTemplateId,
) {
  const projects = await fetchAllProjects();

  const projectIds = projects
    .filter(
      (project) =>
        project?.type === "channelTemplate",
    )
    .map((project) => project.id)
    .filter(Boolean);

  for (const projectId of projectIds) {
    const result = await fetchBirdJson(
      `/workspaces/${encodeURIComponent(
        WORKSPACE_ID,
      )}/projects/${encodeURIComponent(
        projectId,
      )}/channel-templates/${encodeURIComponent(
        channelTemplateId,
      )}`,
    );

    if (result.ok && result.json?.id) {
      return {
        projectId,
        template: result.json,
      };
    }

    if (
      result.status !== 404 &&
      result.status !== 200
    ) {
      console.error(
        "[template] Bird template request failed",
        {
          projectId,
          channelTemplateId,
          status: result.status,
        },
      );
    }
  }

  return null;
}

export async function GET(req) {
  try {
    const { searchParams } =
      new URL(req.url);

    const rawOrgId =
      searchParams.get("orgId");

    const rawTemplateId =
      searchParams.get("id");

    if (
      rawOrgId == null ||
      rawOrgId === ""
    ) {
      return NextResponse.json(
        { error: "Missing orgId" },
        { status: 400 },
      );
    }

    if (
      rawTemplateId == null ||
      rawTemplateId === ""
    ) {
      return NextResponse.json(
        { error: "Missing template id" },
        { status: 400 },
      );
    }

    const channelTemplateId =
      parseUuid(rawTemplateId);

    if (!channelTemplateId) {
      return NextResponse.json(
        { error: "Invalid template id" },
        { status: 400 },
      );
    }

    const orgAuth =
      await requireOwnedOrg(rawOrgId);

    if (orgAuth.error) {
      return orgAuth.error;
    }

    if (!BIRD_API_KEY || !WORKSPACE_ID) {
      return NextResponse.json(
        {
          error:
            "Messaging provider is not configured",
        },
        { status: 500 },
      );
    }

    const authorizedTemplate =
      await requireTemplateForOrganization(
        orgAuth.admin,
        orgAuth.orgId,
        channelTemplateId,
      );

    if (!authorizedTemplate) {
      return NextResponse.json(
        {
          error:
            "Template not found or not authorized",
        },
        { status: 404 },
      );
    }

    const birdResult =
      await findTemplateInBird(
        channelTemplateId,
      );

    if (!birdResult) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    const {
      projectId,
      template,
    } = birdResult;

    return NextResponse.json({
      id: template.id,
      projectId,
      status: (
        template.status || "draft"
      ).toUpperCase(),
      defaultLocale:
        template.defaultLocale,
      variables:
        template.variables || [],
      platformContent:
        template.platformContent || [],
      createdAt:
        template.createdAt,
      updatedAt:
        template.updatedAt,
    });
  } catch (error) {
    return handleApiError(
      error,
      "Failed to load channel template",
    );
  }
}