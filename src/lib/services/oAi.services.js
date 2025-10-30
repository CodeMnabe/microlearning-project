import fs from "fs";
import { stripOpenAICitations } from "./removeOAiCitations";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createOAiAssistant(body) {
  try {
    const createdAssistant = await client.beta.assistants.create({
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      model: body.model,
      top_p: body.top_p,
      temperature: body.temperature,
      tools: [{ type: "file_search" }],
    });

    return createdAssistant;
  } catch (err) {
    console.error(err);
  }
}

export async function getOAiAssistantById(id) {
  try {
    const assistant = await client.beta.assistants.retrieve(`${id}`);
    return assistant;
  } catch (err) {
    console.error(err.message);
  }
}

export async function updateOAiAssistant(updates) {
  try {
    const myUpdatedAssistant = await client.beta.assistants.update(
      `${updates.open_ai_id}`,
      {
        name: updates.name,
        description: updates.description,
        instructions: updates.instructions,
        model: updates.model,
        top_p: updates.top_p,
        temperature: updates.temperature,
      }
    );

    return myUpdatedAssistant;
  } catch (error) {
    console.error(error);
  }
}

export async function deleteOAiAssistant(id) {
  try {
    const wasDeleted = await client.beta.assistants.del(`${id}`);

    if (wasDeleted.deleted) {
      console.log("Assistant Deleted with success");
    } else {
      console.log("Assistant was not deleted");
    }
  } catch (error) {
    console.error(error);
  }
}

export async function createOAiFile(file) {
  try {
    const uploadedFile = await client.files.create({
      file, // File → ReadableStream
      purpose: "assistants", // correct purpose for retrieval
    });

    return uploadedFile;
  } catch (err) {
    return console.error(err.message);
  }
}

export async function createOAiVectorStore(storeName, uploadedFiles) {
  try {
    if (storeName.trim() === "" || !storeName) {
      return console.alert("Name cannot be empty");
    }

    if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
      console.error("At least one file path must be supplied.");
      return null;
    }

    const fileIds = [];
    uploadedFiles.forEach(async (file) => {
      await fileIds.push(file);
    });

    const vectorStore = await client.vectorStores.create({
      name: storeName,
      file_ids: fileIds,
    });
    return vectorStore;
  } catch (err) {
    console.error(err);
  }
}

export async function associateStoreToAssistant(assistantId, store) {
  try {
    const updatedAssistant = await client.beta.assistants.update(assistantId, {
      tool_resources: { file_search: { vector_store_ids: [store.id] } },
    });

    if (!updatedAssistant) {
      return console.error("Assistant wasn't updated");
    }

    return updatedAssistant;
  } catch (err) {
    console.error(err.message);
  }
}

export async function sendMessageToAi(assistantId, input, threadId) {
  try {
    //Todo Later it will have user verification and thread verification per user

    if (!threadId) {
      const newThread = await client.beta.threads.create();
      threadId = newThread.id;
    }

    const newMessage = await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: input,
    });

    const run = await client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    let runStatus = "in_progress";
    while (runStatus !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const runCheck = await client.beta.threads.runs.retrieve(
        threadId,
        run.id
      );
      runStatus = runCheck.status;
    }

    const messages = await client.beta.threads.messages.list(threadId);
    const aiResponse = stripOpenAICitations(
      messages.data[0].content[0].text.value
    );

    return {
      threadId,
      aiResponse,
    };
  } catch (err) {
    console.error(err);
  }
}

export async function deleteOAiVectorStoreAndFiles(storeId, fileIds = []) {
  // delete files first
  for (const fid of fileIds) {
    await deleteFileCompat(fid);
  }
  // then delete the vector store
  if (storeId) await deleteVectorStoreCompat(storeId);
}

async function deleteFileCompat(fileId) {
  if (!fileId) return;
  if (client.files?.del) return client.files.del(fileId); // many 4.x builds
  if (client.files?.delete) return client.files.delete(fileId); // some 4.x builds

  // last resort: raw HTTP (works across versions)
  const res = await client.core.fetch(
    `https://api.openai.com/v1/files/${fileId}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok)
    throw new Error(
      `Failed to delete file ${fileId}: ${res.status} ${res.statusText}`
    );
  return res.json();
}

async function deleteVectorStoreCompat(vectorStoreId) {
  if (!vectorStoreId) return;

  // common 4.x name
  if (client.vectorStores?.del) return client.vectorStores.del(vectorStoreId);
  if (client.vectorStores?.delete)
    return client.vectorStores.delete(vectorStoreId);

  // some older/beta shapes
  if (client.beta?.vectorStores?.del)
    return client.beta.vectorStores.del(vectorStoreId);
  if (client.beta?.vectorStores?.delete)
    return client.beta.vectorStores.delete(vectorStoreId);

  // raw HTTP fallback (needs Assistants beta header)
  const res = await client.core.fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
    {
      method: "DELETE",
      headers: { "OpenAI-Beta": "assistants=v2" },
    }
  );
  if (!res.ok)
    throw new Error(
      `Failed to delete vector store ${vectorStoreId}: ${res.status} ${res.statusText}`
    );
  return res.json();
}

export async function createOAiThread() {
  const aiThread = await client.beta.threads.create();
  return aiThread;
}
