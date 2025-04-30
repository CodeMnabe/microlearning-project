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

export async function writeDb(data) {
  await writeFile(dbPath, JSON.stringify(data, null, 2));
}

export function nextId(counterKey, db) {
  const id = db.counters[counterKey]++;
  return id;
}
