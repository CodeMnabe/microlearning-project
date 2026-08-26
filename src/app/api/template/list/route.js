export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getOrganizationBirdConfig } from "@/lib/repos/organizations.repo";
import {
  handleApiError,
  requireOwnedOrg,
  requireUser,
} from "@/lib/auth/guards";

const BIRD = "https://api.bird.com";
const { BIRD_API_KEY, WORKSPACE_ID } = process.env;

async function fetchAll(path) {
  let next;
  const out = [];

  do {
    const url = new URL(`${BIRD}${path}`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("reverse", "true");
    if (next) url.searchParams.set("pageToken", next);

    const res = await fetch(url, {
      headers: {
        Authorization: `AccessKey ${BIRD_API_KEY}`,
        Accept: "*/*",
      },
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json)}`);

    out.push(...(json.results || []));
    next = json.nextPageToken || null;
  } while (next);

  return out;
}

function pickDeploymentValue(deployments, key) {
  return deployments?.find((d) => d.key === key)?.value || null;
}

const STATUS_RANK = {
  ACTIVE: 4,
  PENDING: 3,
  PENDINGREVIEW: 3,
  DRAFT: 2,
  INACTIVE: 1,
};

function isBetterBirdTemplate(candidate, current) {
  if (!current) return true;

  const candidateRank =
    STATUS_RANK[(candidate.status || "").toUpperCase()] || 0;
  const currentRank = STATUS_RANK[(current.status || "").toUpperCase()] || 0;

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

function isPreferredDbRow(candidate, current) {
  if (!current) return true;

  // Prefer organization-specific rows over global rows.
  const candidateIsOrgSpecific = candidate.org_id != null;
  const currentIsOrgSpecific = current.org_id != null;

  if (candidateIsOrgSpecific !== currentIsOrgSpecific) {
    return candidateIsOrgSpecific;
  }

  return false;
}

function uniqueByWhatsappTemplateId(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = String(item.whatsappTemplateId || item.id || "");

    if (!key) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

export async function GET(req) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");

    const orgAuth = await requireOwnedOrg(orgId, auth);
    if (orgAuth.error) return orgAuth.error;

    if (!BIRD_API_KEY || !WORKSPACE_ID) {
      return NextResponse.json(
        { error: "Missing BIRD envs" },
        { status: 500 },
      );
    }

    const config = await getOrganizationBirdConfig(orgAuth.orgId);
    const projectId = config?.projectId || null;

    const { data: allowedRows, error: dbErr } = await orgAuth.admin
      .from("whatsapp_templates")
      .select(
        "id, org_id, name, language, provider_template_id, components",
      )
      .or(`org_id.eq.${orgAuth.orgId},org_id.is.null`)
      .eq("status", "ACTIVE");

    if (dbErr) throw dbErr;

    const dbByProviderId = new Map();

    for (const row of allowedRows ?? []) {
      if (!row.provider_template_id) continue;

      const providerId = String(row.provider_template_id);
      const current = dbByProviderId.get(providerId);

      if (isPreferredDbRow(row, current)) {
        dbByProviderId.set(providerId, row);
      }
    }

    const allowedIds = new Set(dbByProviderId.keys());

    let projectIds = [];

    if (projectId) {
      projectIds = [projectId];
    } else {
      const projects = await fetchAll(
        `/workspaces/${WORKSPACE_ID}/projects`,
      );

      projectIds = projects
        .filter((project) => project.type === "channelTemplate")
        .map((project) => project.id);
    }

    const raw = [];

    for (const pid of projectIds) {
      const templates = await fetchAll(
        `/workspaces/${WORKSPACE_ID}/projects/${pid}/channel-templates`,
      );

      for (const template of templates) {
        const providerId = String(template.id || "");

        if (!providerId || !allowedIds.has(providerId)) {
          continue;
        }

        const name =
          pickDeploymentValue(
            template.deployments,
            "whatsappTemplateName",
          ) ||
          template.description ||
          template.id;

        const category =
          pickDeploymentValue(
            template.deployments,
            "whatsappCategory",
          ) || "";

        const language =
          template.defaultLocale ||
          template.platformContent?.[0]?.locale ||
          "en";

        const status = (template.status || "draft").toUpperCase();

        let wabaId = null;

        for (const platformContentItem of template.platformContent || []) {
          for (const approval of platformContentItem.approvals || []) {
            if (
              approval.platform === "whatsapp" &&
              approval.platformAccountIdentifier
            ) {
              wabaId = approval.platformAccountIdentifier;
              break;
            }
          }

          if (wabaId) break;
        }

        raw.push({
          provider_template_id: providerId,
          projectId: pid,
          name,
          language,
          category,
          status,
          waba_id: wabaId,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        });
      }
    }

    const bestByProviderId = new Map();

    for (const template of raw) {
      const providerId = String(template.provider_template_id);
      const current = bestByProviderId.get(providerId);

      if (isBetterBirdTemplate(template, current)) {
        bestByProviderId.set(providerId, template);
      }
    }

    const items = Array.from(bestByProviderId.values())
      .map((template) => {
        const providerId = String(template.provider_template_id);
        const dbRow = dbByProviderId.get(providerId);

        if (!dbRow) return null;

        return {
          id: providerId,
          whatsappTemplateId: dbRow.id,
          components: dbRow.components ?? null,
          projectId: template.projectId,
          name: template.name,
          language: template.language,
          category: template.category,
          status: template.status,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      items: uniqueByWhatsappTemplateId(items),
    });
  } catch (e) {
    return handleApiError(e, "Failed to list templates");
  }
}
