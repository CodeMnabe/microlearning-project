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
    const { name, phoneNumber, organizationId, assistantId, email } =
      await req.json();

    if (!name || !phoneNumber || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: name, phoneNumber, organizationId" },
        { status: 400 }
      );
    }

    const _newUser = await createUser({
      organizationId,
      phoneNumber,
      name,
      email,
      assistantId: assistantId ?? null,
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
    return NextResponse.json({
      error: "Failed to create User:" + error.message,
    });
  }
}

// src/app/api/users/route.js  (PATCH)
export async function PATCH(req) {
  try {
    const { id, name, phoneNumber, email, assistantId, tagIds } =
      await req.json();
    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const updatedUser = await updateUser(id, {
      name,
      phoneNumber,
      email,
      assistantId, // ← new
      tagIds, // ← new (array of numbers)
    });

    return NextResponse.json(updatedUser);
  } catch (err) {
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
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
