import { readDb, writeDb, nextId } from "../persistence/db";
import { getOrganization } from "./organizations.repo";
import { createClient } from "@/utils/supabase/server";
require("dotenv").config();
const OpenAI = require("openai");

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
    organization_id: organizationId,
    open_ai_id: openAiId,
    name,
    description,
    model: model,
    instructions,
    top_p: top_p,
    temperature: temperature,
    vector_store_id: null,
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
  return db.assistants.filter((a) => a.organization_id === organizationId);
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
  assistant.vector_store_id = storeId;
  await writeDb(db);
  return true;
}

export async function nullifyVectorStoreToDbAssistant(assistantId) {
  const db = await readDb();
  const assistant = await db.assistants.find((a) => a.id === assistant_id);
  assistant.vector_store_id = null;
  await writeDb(db);
  return true;
}
