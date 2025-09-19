import { readDb, writeDb, nextId } from "../persistence/db";
import { getUserById } from "./user.repo";

export async function createThread({ userId, assistantId, aiThreadId }) {
  const db = await readDb();
  const user = getUserById(db, userId);
  if (!user) {
    throw new Error(`User with id ${userId} does not exist.`);
  }

  const newThread = {
    id: nextId("threadId", db),
    user_id: userId,
    assistant_id: assistantId,
    ai_thread_id: aiThreadId,
    created_at: new Date(),
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
  return db.threads.filter((thread) => thread.user_id === userId);
}
