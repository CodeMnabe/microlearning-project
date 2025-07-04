import { NextResponse } from "next/server";
import { createOrganization } from "@/lib/repos/organizations.repo";

export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name || typeof name != "string") {
      return NextResponse.json(
        { error: "Field «name» is required." },
        { status: 400 }
      );
    }

    const org = await createOrganization(name.trim());

    return NextResponse.json({ org }, { status: 201 });
  } catch (err) {
    console.error("Create org failed: ", err);
    return NextResponse.json(
      { error: "Internal error. Check Server Logs" },
      { status: 500 }
    );
  }
}
