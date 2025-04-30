import { readDb, writeDb, nextId } from "../persistence/db";

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
