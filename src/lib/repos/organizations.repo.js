import { readDb, writeDb, nextId } from "../persistence/db";
// import { supabase } from "../persistence/supadb";

// Organizations
export async function createOrganization(name) {
  const db = await readDb();

  const newOrg = { id: nextId("orgId", db), name };
  console.log("It got here");

  // const { data, error } = await supabase
  //   .from("Organization")
  //   .insert([{ name: name }])
  //   .select();

  // if (error) {
  //   // bubble a clear message up to the route
  //   return console.error(`Supabase insert failed: ${error.message}`);
  // }

  // return data;

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
  console.log(orgId);
  return db.organization.find((o) => o.id == orgId);
}
