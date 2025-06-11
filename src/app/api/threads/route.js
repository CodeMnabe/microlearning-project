import { NextResponse } from "next/server";
import { getThreadsForUser } from "@/lib/repos/threads.repo";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    console.log(searchParams);
    const userId = searchParams.get("userId");
    console.log(userId);
    if (!userId) {
      return NextResponse.json(
        { error: "No userId provided" },
        { status: 400 }
      );
    }

    const userThreads = await getThreadsForUser(Number(userId));
    return NextResponse.json({ threads: userThreads });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
