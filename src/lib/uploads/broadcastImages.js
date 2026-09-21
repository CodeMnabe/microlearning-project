export const BROADCAST_IMAGES_BUCKET = "images";

function makeSafeName(name) {
  const safe = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "file";
}

// O caminho leva a organização na segunda pasta porque a policy do bucket
// público só deixa escrever em broadcasts/<organização de que és owner>/.
export function buildBroadcastImageKey(orgId, fileName) {
  const org = String(orgId ?? "").trim();
  if (!/^[a-zA-Z0-9-]+$/.test(org)) {
    throw new Error("Organização em falta para o upload.");
  }
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `broadcasts/${org}/${unique}-${makeSafeName(fileName)}`;
}
