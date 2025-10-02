import { NextResponse } from "next/server";

const BIRD = "https://api.bird.com";
const { BIRD_API_KEY, WORKSPACE_ID } = process.env;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const channelTemplateId = searchParams.get("id"); // channel-template id

    if (!projectId || !channelTemplateId) {
      return NextResponse.json(
        { error: "Missing projectId or id" },
        { status: 400 }
      );
    }
    if (!BIRD_API_KEY || !WORKSPACE_ID) {
      return NextResponse.json({ error: "Missing BIRD envs" }, { status: 500 });
    }

    const res = await fetch(
      `${BIRD}/workspaces/${WORKSPACE_ID}/projects/${projectId}/channel-templates/${channelTemplateId}`,
      {
        headers: { Authorization: `AccessKey ${BIRD_API_KEY}`, Accept: "*/*" },
        cache: "no-store",
      }
    );
    const json = await res.json();
    if (!res.ok) return NextResponse.json(json, { status: res.status });

    // Return only what the client needs
    return NextResponse.json({
      id: json.id,
      projectId: json.projectId,
      status: (json.status || "draft").toUpperCase(),
      defaultLocale: json.defaultLocale,
      variables: json.variables || [], // [{ key, type, description, characterLimit, examplesLocale, ...}]
      platformContent: json.platformContent || [], // for detecting URL var
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
