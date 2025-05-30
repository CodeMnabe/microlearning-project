import { readDb, writeDb, nextId } from "../persistence/db";

export async function createDBStore(store, fileIds) {
  const db = await readDb();
  const newVectorStore = {
    id: nextId("vectorId", db),
    openAiId: store.id,
    storeName: store.name,
    fileIds: fileIds,
  };

  db.vectorStore.push(newVectorStore);
  await writeDb(db);
  return newVectorStore;
}

export async function getStoreById(storeId) {
  const db = await readDb();
  return db.vectorStore.find((a) => a.id === storeId);
}

export async function deleteStoreById(storeId) {
  const db = await readDb();
  db.vectorStore = db.vectorStore.filter((a) => a.id !== storeId);
  await writeDb(db);
  return true;
}
