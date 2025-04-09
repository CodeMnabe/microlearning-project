import { NextResponse } from "next/server";
import { db, createOrganization, createUser, createThread } from "@/lib/db";

export async function GET() {
  if (db.users.length > 0) {
    return NextResponse.json({ error: "User already exists" });
  }

  const org = createOrganization("TestOrg");

  const newUser = createUser({
    organizationId: org.id,
    phoneNumber: "whatsapp:+351925273952",
    name: "Gaspar",
  });

  const newThread = createThread({
    userId: newUser.id,
    aiThreadId: "thread_skNXvuWshDd8IHKOczpwmar1",
  });

  return NextResponse.json({ message: "Seeding Completed" }, { status: 200 });
}
