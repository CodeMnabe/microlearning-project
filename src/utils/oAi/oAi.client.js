import OpenAI from "openai";

export const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Opt-in to Assistants v2 everywhere
  defaultHeaders: { "OpenAI-Beta": "assistants=v2" },
});
