import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  try {
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
