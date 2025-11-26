import { NextResponse } from "next/server";
import {
  createUser,
  getUsersInOrg,
  updateUser,
  deleteUser,
} from "@/lib/repos/user.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("orgId"));

    if (!id)
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const users = await getUsersInOrg(Number(id));
    return NextResponse.json(users);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const {
      name,
      phoneNumber, // optional legacy full number
      phoneCountryCode, // "+351"
      phoneNational, // "912345678"
      organizationId,
      assistantId,
      email,
    } = await req.json();

    if (!name || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: name, organizationId" },
        { status: 400 }
      );
    }

    // Normalize
    const normalizedNational =
      typeof phoneNational === "string"
        ? phoneNational.replace(/\s+/g, "")
        : "";

    const normalizedCode =
      typeof phoneCountryCode === "string" && phoneCountryCode.trim()
        ? phoneCountryCode.trim()
        : null;

    const fullPhone =
      phoneNumber ??
      (normalizedCode && normalizedNational
        ? `${normalizedCode}${normalizedNational.replace(/\D/g, "")}`
        : null);

    if (!fullPhone) {
      return NextResponse.json(
        { error: "Missing phone number" },
        { status: 400 }
      );
    }

    const _newUser = await createUser({
      organizationId,
      name,
      email,
      assistantId: assistantId ?? null,
      phoneNumber: fullPhone,
      phoneCountryCode: normalizedCode,
      phoneNational: normalizedNational,
    });

    return NextResponse.json(_newUser, { status: 201 });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "User already exists (duplicate key)." },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create User: " + error.message },
      { status: 500 }
    );
  }
}

// src/app/api/users/route.js  (PATCH)
export async function PATCH(req) {
  try {
    const {
      id,
      name,
      phoneNumber, // optional full number
      phoneCountryCode, // "+351"
      phoneNational, // "912345678"
      email,
      assistantId,
      tagIds,
    } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const normalizedNational =
      typeof phoneNational === "string"
        ? phoneNational.replace(/\s+/g, "")
        : undefined; // undefined means "don't touch" in updateUser

    const normalizedCode =
      typeof phoneCountryCode === "string" && phoneCountryCode.trim()
        ? phoneCountryCode.trim()
        : typeof phoneCountryCode === "string"
        ? "" // allow clearing
        : undefined;

    const fullPhone =
      typeof phoneNumber === "string" && phoneNumber.trim()
        ? phoneNumber.trim()
        : normalizedCode && normalizedNational
        ? `${normalizedCode}${normalizedNational.replace(/\D/g, "")}`
        : undefined;

    const updatedUser = await updateUser(id, {
      name,
      email,
      assistantId,
      tagIds,
      phoneNumber: fullPhone,
      phoneCountryCode: normalizedCode,
      phoneNational: normalizedNational,
    });

    return NextResponse.json(updatedUser);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = Number(searchParams.get("id"));
    if (!userId) {
      return NextResponse.json(
        {
          error: "Missing UserId",
        },
        { status: 400 }
      );
    }

    await deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
