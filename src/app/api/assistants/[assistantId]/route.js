import { NextResponse } from "next/server";
import { getAssistantsById } from "@/lib/db";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req, { params }) {
  // Next.js 13 passes dynamic route segments in `params`
  // so /api/assistants/123 => params.assistantId = "123"
  try {
    const assistantId = Number(params.assistantId);
    console.log(assistantId);
    const assistant = await getAssistantById(assistantId);
    if (!assistant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(assistant, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
