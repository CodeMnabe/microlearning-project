import { readFile, writeFile } from "fs/promises";
import path from "path";
import { logger } from "@/lib/observability/logger";

const dbPath = path.resolve(process.cwd(), "db.json");

export async function readDb() {
  try {
    const data = await readFile(dbPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    logger.error(
      "local_persistence_read_failed",
      {
        provider: "filesystem",
        operation: "local_database_read",
        outcome: "failed",
      },
      err,
    );
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
