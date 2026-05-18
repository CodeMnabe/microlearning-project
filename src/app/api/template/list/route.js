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
      headers: { Authorization: `AccessKey ${BIRD_API_KEY}`, Accept: "*/*" },
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

function isBetter(b, a) {
  if (!a) return true;

  const rb = STATUS_RANK[(b.status || "").toUpperCase()] || 0;
  const ra = STATUS_RANK[(a.status || "").toUpperCase()] || 0;
  if (rb !== ra) return rb > ra;

  const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
  const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
  return tb > ta;
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
      .select("id, name, language, provider_template_id, components")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq("status", "ACTIVE");

    if (dbErr) throw new Error(dbErr.message);

    const norm = (s) =>
      String(s ?? "")
        .trim()
        .toLowerCase();

    const allowedIds = new Set(
      (allowedRows ?? []).map((r) => r.provider_template_id).filter(Boolean),
    );

    const allowedKey = new Set(
      (allowedRows ?? []).map((r) => `${norm(r.name)}__${norm(r.language)}`),
    );

    const allowedNameOnly = new Set(
      (allowedRows ?? []).map((r) => norm(r.name)),
    );

    const dbByProviderId = new Map();
    const dbByNameLang = new Map();

    for (const row of allowedRows ?? []) {
      if (row.provider_template_id) {
        dbByProviderId.set(String(row.provider_template_id), row);
      }
      dbByNameLang.set(`${norm(row.name)}__${norm(row.language)}`, row);
    }

    let projectIds = [];
    if (projectId) {
      projectIds = [projectId];
    } else {
      const projects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects`);
      projectIds = projects
        .filter((p) => p.type === "channelTemplate")
        .map((p) => p.id);
    }

    const raw = [];

    for (const pid of projectIds) {
      const tpls = await fetchAll(
        `/workspaces/${WORKSPACE_ID}/projects/${pid}/channel-templates`,
      );

      for (const t of tpls) {
        const name =
          pickDeploymentValue(t.deployments, "whatsappTemplateName") ||
          t.description ||
          t.id;

        const category =
          pickDeploymentValue(t.deployments, "whatsappCategory") || "";

        const language =
          t.defaultLocale || t.platformContent?.[0]?.locale || "en";

        const status = (t.status || "draft").toUpperCase();

        let wabaId = null;
        for (const pc of t.platformContent || []) {
          for (const ap of pc.approvals || []) {
            if (ap.platform === "whatsapp" && ap.platformAccountIdentifier) {
              wabaId = ap.platformAccountIdentifier;
              break;
            }
          }
          if (wabaId) break;
        }

        raw.push({
          provider_template_id: t.id,
          projectId: pid,
          name,
          language,
          category,
          status,
          waba_id: wabaId,
          defaultLocale: t.defaultLocale || null,
          variables: t.variables || [],
          platformContent: t.platformContent || [],
          genericContent: t.genericContent || [],
          deployments: t.deployments || [],
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        });
      }
    }

    const bestByKey = new Map();

    for (const t of raw) {
      const key = `${t.name}__${t.language}`;
      const current = bestByKey.get(key);
      if (isBetter(t, current)) bestByKey.set(key, t);
    }

    const best = Array.from(bestByKey.values());

    const filtered = best.filter((t) => {
      const k = `${norm(t.name)}__${norm(t.language)}`;
      return (
        allowedIds.has(t.provider_template_id) ||
        allowedKey.has(k) ||
        allowedNameOnly.has(norm(t.name))
      );
    });

    const items = filtered.map((t) => {
      const k = `${norm(t.name)}__${norm(t.language)}`;

      const dbRow =
        dbByProviderId.get(String(t.provider_template_id)) ||
        dbByNameLang.get(k) ||
        null;

      return {
        id: t.provider_template_id, // keep Bird/provider id for broadcast page
        whatsappTemplateId: dbRow?.id ?? null, // Supabase UUID for automations FK
        components: dbRow?.components ?? null, // useful for template bindings
        projectId: t.projectId,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
