import { readDb, writeDb, nextId } from "../persistence/db";

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
