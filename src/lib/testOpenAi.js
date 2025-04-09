#!/usr/bin/env node
require("dotenv").config({ path: ".env.local" }); // loads .env
const { performance } = require("perf_hooks"); // for timing
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Grab the threadId from CLI args: node testOpenAiThread.js <threadId>
const threadId = process.argv[2];
if (!threadId) {
  console.error("Usage: node testOpenAiThread.js <threadId>");
  process.exit(1);
}

async function testOpenAiThread(threadId) {
  const startTime = performance.now();
  try {
    // Make the Threads API call
    const response = await client.beta.threads.messages.list(threadId);

    // End timing
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    // Log results
    console.log(
      `Fetched ${response.data.length} messages for thread: ${threadId}`
    );
    console.log(`Time taken: ${durationMs.toFixed(2)} ms`);
    console.log("Messages returned:", response.data);
  } catch (err) {
    console.error("Error fetching thread messages:", err);
  }
}

// Run the test
testOpenAiThread(threadId);
