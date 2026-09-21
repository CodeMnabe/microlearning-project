import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/db/admin";

function hashIdentity(type, value) {
  return createHash("sha256").update(`${type}:${value}`).digest("hex");
}

export function getClientIp(headerStore) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function consumeAuthAttempt(action, email) {
  const headerStore = await headers();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const ip = getClientIp(headerStore);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consume_auth_attempt", {
    p_action: action,
    p_email_hash: hashIdentity("email", normalizedEmail),
    p_ip_hash: hashIdentity("ip", ip),
  });

  // Permite o rollout do código antes da migration, sem bloquear contas
  // existentes. Assim que a função existir, qualquer outra falha fecha o acesso.
  if (error?.code === "PGRST202") return true;
  if (error) throw error;
  return data === true;
}
