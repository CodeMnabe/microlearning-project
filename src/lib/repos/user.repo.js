import { readDb, writeDb, nextId } from "../persistence/db";

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
