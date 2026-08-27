import { NextResponse } from "next/server";
import { createOrganization } from "@/lib/repos/organizations.repo";
import { handleApiError, requireUser } from "@/lib/auth/guards";

function parseUuid(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  const isValidUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    );

  return isValidUuid ? normalized : null;
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

    const {
      name,
      channelId: rawChannelId,
    } = body || {};

    if (typeof name !== "string") {
      return NextResponse.json(
        { error: "Field «name» is required." },
        { status: 400 },
      );
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      return NextResponse.json(
        { error: "Field «name» is required." },
        { status: 400 },
      );
    }

    if (normalizedName.length > 150) {
      return NextResponse.json(
        {
          error:
            "Field «name» must not exceed 150 characters.",
        },
        { status: 400 },
      );
    }

    const channelId = parseUuid(rawChannelId);

    if (!channelId) {
      return NextResponse.json(
        {
          error:
            "A valid messaging channelId is required.",
        },
        { status: 400 },
      );
    }

    const org = await createOrganization({
      name: normalizedName,
      ownerUserId: auth.user.id,
      channelId,
    });

    return NextResponse.json(
      { org },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(
      err,
      "Internal error. Check Server Logs",
    );
  }
}