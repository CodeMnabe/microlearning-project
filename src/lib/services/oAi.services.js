import fs from "fs";
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
      `${updates.openAiId}`,
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
    console.log("Trying to delete on OpenAI");
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
      console.log("New thread created");
    }

    console.log(threadId);
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
    const aiResponse = messages.data[0].content[0].text.value;

    return {
      threadId,
      aiResponse,
    };
  } catch (err) {
    console.error(err);
  }
}

export async function deleteOAiVectorStoreAndFiles(store, fileIds) {
  try {
    for (const fileId of fileIds) {
      await client.files.del(fileId);
    }

    const deletedStore = await client.vectorStores.del(store);

    return deletedStore.deleted;
  } catch (err) {
    console.error(err);
  }
}

export async function createOAiThread() {
  const aiThread = await client.beta.threads.create();
  return aiThread;
}
