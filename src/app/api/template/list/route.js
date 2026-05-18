export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BIRD = "https://api.bird.com";
const { BIRD_API_KEY, WORKSPACE_ID } = process.env;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

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

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function nameLangKey(name, language) {
  return `${norm(name)}__${norm(language)}`;
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
    const url = new URL(req.url);
    const orgIdStr = url.searchParams.get("orgId");
    const projectId = url.searchParams.get("projectId");
    const orgId = Number(orgIdStr);

    if (!orgIdStr || Number.isNaN(orgId)) {
      return NextResponse.json(
        { error: "Missing or invalid orgId" },
        { status: 400 },
      );
    }

    if (!BIRD_API_KEY || !WORKSPACE_ID) {
      return NextResponse.json({ error: "Missing BIRD envs" }, { status: 500 });
    }

    const { data: allowedRows, error: dbErr } = await supabaseAdmin
      .from("whatsapp_templates")
      .select("id, org_id, name, language, provider_template_id, components")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq("status", "ACTIVE");

    if (dbErr) throw new Error(dbErr.message);

    const allowedIds = new Set(
      (allowedRows ?? [])
        .map((row) => row.provider_template_id)
        .filter(Boolean)
        .map((id) => String(id)),
    );

    const allowedNameLangKeys = new Set(
      (allowedRows ?? []).map((row) => nameLangKey(row.name, row.language)),
    );

    const dbByProviderId = new Map();
    const dbByNameLang = new Map();

    for (const row of allowedRows ?? []) {
      if (row.provider_template_id) {
        const providerId = String(row.provider_template_id);
        const current = dbByProviderId.get(providerId);

        if (isPreferredDbRow(row, current)) {
          dbByProviderId.set(providerId, row);
        }
      }

      const key = nameLangKey(row.name, row.language);
      const current = dbByNameLang.get(key);

      if (isPreferredDbRow(row, current)) {
        dbByNameLang.set(key, row);
      }
    }

    let projectIds = [];

    if (projectId) {
      projectIds = [projectId];
    } else {
      const projects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects`);

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
          provider_template_id: template.id,
          projectId: pid,
          name,
          language,
          category,
          status,
          waba_id: wabaId,
          defaultLocale: template.defaultLocale || null,
          variables: template.variables || [],
          platformContent: template.platformContent || [],
          genericContent: template.genericContent || [],
          deployments: template.deployments || [],
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        });
      }
    }

    // Keep only the best Bird template per normalized name + language.
    // This prevents duplicate Bird versions with slightly different casing/spaces
    // from mapping to the same Supabase template row.
    const bestByNameLang = new Map();

    for (const template of raw) {
      const key = nameLangKey(template.name, template.language);
      const current = bestByNameLang.get(key);

      if (isBetterBirdTemplate(template, current)) {
        bestByNameLang.set(key, template);
      }
    }

    const bestTemplates = Array.from(bestByNameLang.values());

    // Only allow templates that match the DB either by provider_template_id
    // or by exact normalized name + language.
    // Important: no name-only fallback, because that creates false matches.
    const allowedTemplates = bestTemplates.filter((template) => {
      const providerId = String(template.provider_template_id);
      const key = nameLangKey(template.name, template.language);

      return allowedIds.has(providerId) || allowedNameLangKeys.has(key);
    });

    const items = allowedTemplates
      .map((template) => {
        const providerId = String(template.provider_template_id);
        const key = nameLangKey(template.name, template.language);

        const dbRow =
          dbByProviderId.get(providerId) || dbByNameLang.get(key) || null;

        // Automations need the Supabase UUID, so do not return templates
        // that cannot map back to whatsapp_templates.
        if (!dbRow) return null;

        return {
          // Bird/provider template id.
          // Useful for broadcast sending.
          id: template.provider_template_id,

          // Supabase UUID.
          // Useful for automations FK.
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
    return NextResponse.json(
      { error: e.message || "Failed to list templates" },
      { status: 500 },
    );
  }
}
