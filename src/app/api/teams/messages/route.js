export async function GET() {
  console.log("[TEAMS] GET /api/teams/messages (health)");
  return new Response("ok", { status: 200 });
}

export async function POST(req) {
  const body = await req.text(); // log raw – bot framework posts JSON
  console.log("[TEAMS] POST /api/teams/messages", body);
  // For now, just acknowledge so Azure/Teams sees 200 (we’ll wire Bot Framework later)
  return new Response("", { status: 200 });
}
