import "server-only";
import { getSupabaseAdminClient } from "@/lib/db/admin";

export async function getAssuranceLevel(supabase) {
  const { data: assuranceData, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError || !assuranceData) {
    throw new Error("Unable to determine authenticator assurance level");
  }

  const { data: factorData, error: factorError } =
    await supabase.auth.mfa.listFactors();

  if (factorError || !factorData || !Array.isArray(factorData.all)) {
    throw new Error("Unable to determine authenticator assurance level");
  }

  const hasVerifiedFactor = factorData.all.some(
    (factor) => factor?.status === "verified",
  );

  return {
    currentLevel: assuranceData.currentLevel,
    nextLevel: hasVerifiedFactor ? assuranceData.nextLevel : "aal1",
    currentFactor: assuranceData.currentAuthenticationFactor || null,
  };
}

export async function isOrganizationOwner(userId) {
  if (!userId) return false;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to determine organization ownership");
  }

  return Boolean(data);
}

export function checkMfaEnforcement({ isPrivileged, currentLevel, nextLevel }) {
  if (!isPrivileged) {
    return { required: false, action: "allow" };
  }

  if (currentLevel === "aal2" && nextLevel === "aal2") {
    return { required: false, action: "allow" };
  }

  if (currentLevel === "aal1" && nextLevel === "aal2") {
    return { required: true, action: "challenge" };
  }

  return { required: true, action: "enrollment" };
}

export async function getMfaStatus(supabase, userId) {
  const privileged = await isOrganizationOwner(userId);

  if (!privileged) {
    return {
      requiresEnrollment: false,
      requiresChallenge: false,
      isPrivileged: false,
      currentLevel: null,
      nextLevel: null,
      action: "allow",
    };
  }

  const assurance = await getAssuranceLevel(supabase);

  const enforcement = checkMfaEnforcement({
    isPrivileged: privileged,
    currentLevel: assurance.currentLevel,
    nextLevel: assurance.nextLevel,
  });

  return {
    requiresEnrollment: enforcement.action === "enrollment",
    requiresChallenge: enforcement.action === "challenge",
    isPrivileged: privileged,
    currentLevel: assurance.currentLevel,
    nextLevel: assurance.nextLevel,
    action: enforcement.action,
  };
}
