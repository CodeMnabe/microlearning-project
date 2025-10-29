// src/utils/oAi/oAi.client.js
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  // Fail early in prod so you see it in logs
  console.warn("[OpenAI] OPENAI_API_KEY is not set");
}

export const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Keep Assistants v2 header for any legacy calls you still have.
  defaultHeaders: { "OpenAI-Beta": "assistants=v2" },
  // Optional hardening:
  // maxRetries: 2,
  // timeout: 60_000,
});
