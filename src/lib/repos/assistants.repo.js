import { readDb, writeDb, nextId } from "../persistence/db";
import { getOrganization } from "./organizations.repo";
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createAssistant({
  organizationId,
  openAiId,
  name,
  description,
  instructions,
  model,
  top_p,
  temperature,
}) {
  const org = getOrganization(organizationId);
  if (!org) {
    throw new Error(`Organization with id ${organizationId} does not exist.`);
  }

  const db = await readDb();

  const newAssistant = {
    id: nextId("assistantId", db),
    organizationId,
    openAiId,
    name,
    description,
    model: model,
    instructions,
    top_p: top_p,
    temperature: temperature,
    vectorStoreId: null,
    createdAt: new Date(),
  };

  db.assistants.push(newAssistant);
  await writeDb(db);
  return newAssistant;
}

export async function updateAssistant(assistantId, updates) {
  const db = await readDb();
  const assistant = db.assistants.find((a) => a.id === assistantId);

  if (!assistant) {
    throw new Error(`Assistant with id ${assistantId} does not exist.`);
  }

  Object.assign(assistant, updates);
  await writeDb(db);
  return assistant;
}

export async function getAssistantsInOrg(organizationId) {
  const db = await readDb();
  return db.assistants.filter((a) => a.organizationId === organizationId);
}

export async function getAssistantById(id) {
  const db = await readDb();
  return db.assistants.find((a) => a.id === id);
}

export async function deleteAssistant(id) {
  const db = await readDb();
  db.assistants = db.assistants.filter((a) => a.id !== id);
  await writeDb(db);
  return true;
}

export async function associateVectorStoreToDbAssistant(assistantId, storeId) {
  const db = await readDb();
  const assistant = await db.assistants.find((a) => a.id === assistantId);
  assistant.vectorStoreId = storeId;
  await writeDb(db);
  return true;
}

export async function nullifyVectorStoreToDbAssistant(assistantId) {
  const db = await readDb();
  const assistant = await db.assistants.find((a) => a.id === assistantId);
  assistant.vectorStoreId = null;
  await writeDb(db);
  return true;
}
