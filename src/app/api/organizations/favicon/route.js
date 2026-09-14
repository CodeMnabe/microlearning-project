export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/auth/guards";
import { loadOrganizationFavicon } from "@/lib/services/organizationFavicon.service";

// Logo paths carry a UUID, so a rendered favicon never changes for a given path.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(request) {
  try {
    const path = new URL(request.url).searchParams.get("path");
    const png = await loadOrganizationFavicon(path);

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    if (error?.status === 400 || error?.status === 404) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return handleApiError(error, "Failed to render organization favicon");
  }
}
