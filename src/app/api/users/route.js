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
    const id = searchParams.get("orgId");
    console.log(id);

    const users = await getUsersInOrg(Number(id));
    return NextResponse.json(users);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, phoneNumber, organizationId } = body;

    if (!name || !phoneNumber || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: name, phoneNumber, organizationId" },
        { status: 400 }
      );
    }

    const _newUser = createUser({
      organizationId: organizationId,
      name: name,
      phoneNumber: phoneNumber,
    });

    return NextResponse.json({ message: _newUser }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: "Failed to create User:" + error.message,
    });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, name, phoneNumber } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const updates = {};

    if (name !== undefined) {
      updates.name = name;
    }

    if (phoneNumber !== undefined) {
      updates.phoneNumber = phoneNumber;
    }

    const updatedUser = await updateUser(id, updates);

    console.log("Updated user in PATCH:", updatedUser);

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to update User:" + error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");
    if (!userId) {
      return NextResponse.json(
        {
          error: "Missing UserId",
        },
        { status: 400 }
      );
    }

    await deleteUser(Number(userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to delete User:" + err.message,
      },
      {
        status: 500,
      }
    );
  }
}
