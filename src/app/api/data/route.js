import { NextResponse } from "next/server";
import { readDb } from "@/lib/db.js";

export async function GET() {
  const { organization, users, threads, messages } = await readDb();

  return NextResponse.json({ organization, users, threads, messages });
}
