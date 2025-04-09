import { NextResponse } from "next/server";
import { getMessagesInThread, createMessage } from "@/lib/db";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    if (!threadId) {
      return NextResponse.json(
        { error: "No threadId provided" },
        { status: 400 }
      );
    }

    //* Get Messages stored in the database, if they don't exist use openai to get the messages from that thread and create database messages
    let _messages = await getMessagesInThread(threadId);

    if (_messages.length == 0) {
      _messages = await client.beta.threads.messages.list(threadId);

      for (const message of _messages.data) {
        await createMessage({
          threadId: message.thread_id,
          messageId: message.id,
          content: message.content[0].text.value,
          role: message.role.toUpperCase(),
        });
      }

      _messages = await getMessagesInThread(threadId);
    }
    return NextResponse.json({ messages: _messages });
  } catch (error) {
    console.error("Error fetching OpenAI messages:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
