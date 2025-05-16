import { readDb, writeDb, nextId } from "../persistence/db";

export async function createDBFile(oAiId, file) {
  const db = await readDb();
  const newFile = {
    id: nextId("fileId", db),
    openAiId: oAiId,
    name: file.name,
    size: file.size,
  };

  db.files.push(newFile);
  await writeDb(db);
  return newFile.id;
}

export async function getFileById(id) {
  const db = await readDb();
  return db.files.find((a) => a.id === id);
}
