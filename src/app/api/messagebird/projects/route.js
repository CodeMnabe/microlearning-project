import { NextResponse } from "next/server";
import {
  handleApiError,
  requireOwnedOrg,
  throwHttpError,
} from "@/lib/auth/guards";
import { logger } from "@/lib/observability/logger";

const BIRD = "https://api.bird.com";
const { BIRD_API_KEY, WORKSPACE_ID } = process.env;

async function fetchAll(path) {
  let next = null;
  const out = [];

  do {
    const url = new URL(`${BIRD}${path}`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("reverse", "true");

    if (next) {
      url.searchParams.set("pageToken", next);
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `AccessKey ${BIRD_API_KEY}`,
        Accept: "*/*",
      },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      logger.error("provider_request_failed", {
        provider: "bird",
        operation: "projects_list",
        outcome: "failed",
        statusCode: res.status,
      });

      throwHttpError("Messaging provider request failed", 502);
    }

    out.push(...(json?.results || []));
    next = json?.nextPageToken || null;
  } while (next);

  return out;
}

async function getAllowedTemplateIds(admin, orgId) {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("provider_template_id")
    .eq("org_id", orgId)
    .not("provider_template_id", "is", null);

  if (error) {
    logger.error(
      "authorization_lookup_failed",
      {
        provider: "supabase",
        operation: "template_authorization_lookup",
        outcome: "failed",
        organizationId: orgId,
      },
      error,
    );

    throwHttpError("Authorization check failed", 500);
  }

  return new Set(
    (data || [])
      .map((row) => row.provider_template_id)
      .filter(Boolean)
      .map(String),
  );
}

function pickDeploymentValue(deployments, key) {
  return (
    deployments?.find((deployment) => deployment.key === key)?.value || null
  );
}

const STATUS_RANK = {
  ACTIVE: 4,
  PENDING: 3,
  PENDINGREVIEW: 3,
  DRAFT: 2,
  INACTIVE: 1,
};

function isBetter(candidate, current) {
  if (!current) return true;

  const candidateRank = STATUS_RANK[candidate.status] || 0;
  const currentRank = STATUS_RANK[current.status] || 0;

  if (candidateRank !== currentRank) {
    return candidateRank > currentRank;
  }

  const candidateTime = new Date(
    candidate.updatedAt || candidate.createdAt || 0,
  ).getTime();

  const currentTime = new Date(
    current.updatedAt || current.createdAt || 0,
  ).getTime();

  return candidateTime > currentTime;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const requestedProjectId = url.searchParams.get("projectId")?.trim();

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    if (!BIRD_API_KEY || !WORKSPACE_ID) {
      return NextResponse.json(
        { error: "Messaging provider is not configured" },
        { status: 500 },
      );
    }

    const allowedTemplateIds = await getAllowedTemplateIds(
      orgAuth.admin,
      orgAuth.orgId,
    );

    if (allowedTemplateIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    let projectIds = [];

    if (requestedProjectId) {
      projectIds = [requestedProjectId];
    } else {
      const projects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects`);

      projectIds = projects
        .filter((project) => project.type === "channelTemplate")
        .map((project) => project.id)
        .filter(Boolean);
    }

    const all = [];

    for (const projectId of projectIds) {
      const templates = await fetchAll(
        `/workspaces/${WORKSPACE_ID}/projects/${encodeURIComponent(
          projectId,
        )}/channel-templates`,
      );

      for (const template of templates) {
        if (!allowedTemplateIds.has(String(template.id))) {
          continue;
        }

        const name =
          pickDeploymentValue(template.deployments, "whatsappTemplateName") ||
          template.description ||
          template.id;

        const category =
          pickDeploymentValue(template.deployments, "whatsappCategory") || "";

        const language =
          template.defaultLocale ||
          template.platformContent?.[0]?.locale ||
          "en";

        all.push({
          id: template.id,
          projectId,
          name,
          language,
          category,
          status: (template.status || "draft").toUpperCase(),
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        });
      }
    }

    const byKey = new Map();

    for (const template of all) {
      const key = `${template.name}__${template.language}`;
      const current = byKey.get(key);

      if (isBetter(template, current)) {
        byKey.set(key, template);
      }
    }

    const items = Array.from(byKey.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, "Failed to load WhatsApp templates");
  }
}
