export function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name || user.user || user.nome || "Sem nome",
    email: user.email,
    phoneNumber: user.phone_number || user.phoneNumber || "",
    phoneCountryCode: user.phone_country_code || "",
    phoneNational: user.phone_national || "",
    teamsAadObjectId: user.teams_aad_object_id || "",
  };
}

function getWhatsAppRecipient(user) {
  if (user.phoneNumber) return user.phoneNumber.trim();

  const code = String(user.phoneCountryCode || "").trim();
  const national = String(user.phoneNational || "")
    .trim()
    .replace(/\s+/g, "");

  if (code && national) return `${code}${national}`;
  return "";
}

function getTeamsRecipient(user) {
  return (
    String(user.teamsFromId || "").trim() ||
    String(user.teamsAadObjectId || "").trim() ||
    ""
  );
}

export function getRecipientForChannel(user, channel) {
  if (channel === "whatsapp") return getWhatsAppRecipient(user);
  if (channel === "teams") return getTeamsRecipient(user);
  return "";
}

export function getRecipientSecondary(user, channel) {
  if (channel === "whatsapp") {
    return getWhatsAppRecipient(user) || user.email || "-";
  }

  if (channel === "temas") {
    return (
      String(user.teamsFromId || "").trim() ||
      String(user.teamsAadObjectId || "").trim() ||
      user.email ||
      "-"
    );
  }

  return user.email || "-";
}

export function mapRecipientsToEntries(recipients, candidates) {
  const byRecipient = new Map(
    candidates.map((candidate) => [candidate.recipient, candidate]),
  );

  return recipients.map((recipient) => {
    const found = byRecipient.get(recipient);
    if (found) return found;

    return {
      id: recipient,
      name: recipient,
      recipient,
      secondary: "Sem utilizador associado",
    };
  });
}
