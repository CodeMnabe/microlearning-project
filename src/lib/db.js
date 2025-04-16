//TODO: CHANGE EVERYTHING TO USE FS/PROMISE
import { readFile, writeFile } from "fs/promises";
import path from "path";

const dbPath = path.resolve(process.cwd(), "db.json");

export async function readDb() {
  try {
    const data = await readFile(dbPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read db.json", err);
    throw err;
  }
}

async function writeDb(data) {
  await writeFile(dbPath, JSON.stringify(data, null, 2));
}

function nextId(counterKey, db) {
  const id = db.counters[counterKey]++;
  return id;
}

// Organizations
export async function createOrganization(name) {
  const db = await readDb();

  const newOrg = { id: nextId("orgId", db), name };

  db.organization.push(newOrg);
  await writeDb(db);
  return newOrg;
}

export async function getAllOrganization() {
  const db = await readDb();
  return db.organization;
}

export async function getOrganization(orgId) {
  const db = await readDb();
  return db.organization.find((o) => o.id == orgId);
}

//Assistants
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

// Users
export async function createUser({ organizationId, phoneNumber, name }) {
  const org = getOrganization(organizationId);
  if (!org) {
    throw new Error(`Organization with id ${organizationId} does not exist.`);
  }

  const db = await readDb();

  const cleanNumber = phoneNumber.replace(/\D/g, "").slice(-9);

  const newUser = {
    id: nextId("userId", db),
    organizationId,
    phoneNumber: cleanNumber,
    name,
    createdAt: new Date(),
  };

  db.users.push(newUser);
  await writeDb(db);
  return newUser;
}

export async function deleteUser(userId) {
  const db = await readDb();
  db.users = db.users.filter((u) => u.id !== userId);
  await writeDb(db);
  return true;
}

export async function updateUser(userId, updates) {
  const db = await readDb();
  const user = await getUserById(db, userId);
  if (!user) {
    throw new Error(`User with id ${userId} does not exist.`);
  }

  Object.assign(user, updates);
  await writeDb(db);
  return user;
}

export async function getUserById(db, userId) {
  return db.users.find((user) => user.id === userId);
}

export async function getUserByNumber(phoneNumber) {
  const db = await readDb();
  return db.users.find((user) => user.phoneNumber === phoneNumber);
}

export async function getUsersInOrg(orgId) {
  const db = await readDb();
  return db.users.filter((user) => user.organizationId === orgId);
}

// Threads
export async function createThread({ userId, aiThreadId }) {
  const db = await readDb();
  const user = getUserById(db, userId);
  if (!user) {
    throw new Error(`User with id ${userId} does not exist.`);
  }

  const newThread = {
    id: nextId("threadId", db),
    userId,
    aiThreadId,
    createdAt: new Date(),
  };

  db.threads.push(newThread);
  await writeDb(db);
  return newThread;
}

export async function getThreadById(threadId) {
  const db = await readDb();
  return db.threads.find((thread) => thread.id === threadId);
}

export async function getThreadsForUser(userId) {
  const db = await readDb();
  return db.threads.filter((thread) => thread.userId === userId);
}

// Messages
export async function createMessage({
  threadId,
  messageId,
  whatsAppId,
  content,
  role,
}) {
  const db = await readDb();

  const newMessage = {
    id: nextId("messageId", db),
    threadId: threadId ? threadId : "Unknown",
    messageId: messageId ? messageId : "Unknown",
    whatsAppId: whatsAppId ? whatsAppId : "Unknown",
    content,
    role,
    createdAt: new Date(),
  };

  db.messages.push(newMessage);
  console.log("Created message with ID: " + newMessage.id);
  await writeDb(db);
  return newMessage;
}

export async function getAllMessages() {
  const db = await readDb();
  return db.messages;
}

export async function getMessagesInThread(threadId) {
  const db = await readDb();
  return db.messages.filter((message) => message.threadId === threadId);
}

async function populateInitialDb() {
  const db = await readDb();
  // Only seed if DB is empty
  if (db.organization.length === 0 && db.users.length === 0) {
    const org = await createOrganization("TestOrg");
    if (org) {
      console.log("Created Organization");
    }
    const newUser = await createUser({
      organizationId: org.id,
      phoneNumber: "whatsapp:+351925273952",
      name: "Gaspar",
    });
    if (newUser) {
      console.log("Created User");
    }
    await createThread({
      userId: newUser.id,
      aiThreadId: "thread_skNXvuWshDd8IHKOczpwmar1",
    });
  }
}

await populateInitialDb();
