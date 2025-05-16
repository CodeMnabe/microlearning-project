import { readDb, writeDb, nextId } from "../persistence/db";

export async function createDBStore(store, fileIds) {
  const db = await readDb();
  const newVectorStore = {
    id: nextId("vectorId", db),
    storeName: store.name,
    fileId: fileIds,
  };

  db.vectorStore.push(newVectorStore);
  await writeDb(db);
  return newVectorStore;
}
