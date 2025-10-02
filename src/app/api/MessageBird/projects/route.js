import { NextResponse } from "next/server";

const BIRD = "https://api.bird.com";
const { BIRD_API_KEY, WORKSPACE_ID } = process.env;

async function fetchAll(path) {
  let next,
    out = [];
  do {
    const url = new URL(`${BIRD}${path}`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("reverse", "true"); // newest first helps tie-breaks
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

// rank for choosing the best version of the same template
const STATUS_RANK = {
  ACTIVE: 4,
  PENDING: 3,
  PENDINGREVIEW: 3,
  DRAFT: 2,
  INACTIVE: 1,
};

function isBetter(b, a) {
  // return true if b is better than a
  if (!a) return true;
  const rb = STATUS_RANK[b.status] || 0;
  const ra = STATUS_RANK[a.status] || 0;
  if (rb !== ra) return rb > ra;
  const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
  const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
  return tb > ta;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const projectId = url.searchParams.get("projectId"); // optional

    if (!orgId)
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    if (!BIRD_API_KEY || !WORKSPACE_ID) {
      return NextResponse.json({ error: "Missing BIRD envs" }, { status: 500 });
    }

    // 1) Which projects?
    let projectIds = [];
    if (projectId) {
      projectIds = [projectId];
    } else {
      const projects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects`);
      projectIds = projects
        .filter((p) => p.type === "channelTemplate")
        .map((p) => p.id);
    }

    // 2) Gather all channel-templates
    const all = [];
    for (const pid of projectIds) {
      const tpls = await fetchAll(
        `/workspaces/${WORKSPACE_ID}/projects/${pid}/channel-templates`
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
        all.push({
          id: t.id,
          projectId: pid,
          name,
          language,
          category,
          status: (t.status || "draft").toUpperCase(),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        });
      }
    }

    // 3) Dedupe by name+language → keep the best version
    const byKey = new Map();
    for (const t of all) {
      const key = `${t.name}__${t.language}`;
      const current = byKey.get(key);
      if (isBetter(t, current)) byKey.set(key, t);
    }
    const items = Array.from(byKey.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // optional: include how many were collapsed
    // const collapsed = all.length - items.length;

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
