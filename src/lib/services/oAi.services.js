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

export async function createOAiVectorStore() {}
