function cleanValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeHeaders(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      String(key || "")
        .trim()
        .toLowerCase(),
      cleanValue(value),
    ]),
  );
}

function getFirst(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value) return value;
  }

  return "";
}

function splitPhone(rawPhone, defaultPhoneCode = "+351") {
  const phone = cleanValue(rawPhone);
  if (!phone) {
    return {
      phoneNumber: null,
      phoneCountryCode: null,
      phoneNational: null,
    };
  }

  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) {
    return {
      phoneNumber: null,
      phoneCountryCode: null,
      phoneNational: null,
    };
  }

  // If already international
  if (cleaned.startsWith("+")) {
    // Best case: matches org default code
    if (defaultPhoneCode && cleaned.startsWith(defaultPhoneCode)) {
      return {
        phoneNumber: cleaned,
        phoneCountryCode: defaultPhoneCode,
        phoneNational: cleaned
          .slice(defaultPhoneCode.length)
          .replace(/\D/g, ""),
      };
    }

    // Keep full number, but avoid guessing the country code incorrectly
    return {
      phoneNumber: cleaned,
      phoneCountryCode: null,
      phoneNational: cleaned.slice(1).replace(/\D/g, "") || null,
    };
  }

  // Local/national number
  const national = cleaned.replace(/\D/g, "");
  if (!national) {
    return {
      phoneNumber: null,
      phoneCountryCode: null,
      phoneNational: null,
    };
  }

  return {
    phoneNumber: `${defaultPhoneCode}${national}`,
    phoneCountryCode: defaultPhoneCode || null,
    phoneNational: national,
  };
}

export default function mapCsvRow(
  rawRow,
  defaultPhoneCode = "+351",
  assistantId = null,
) {
  const row = normalizeHeaders(rawRow);

  const phone = splitPhone(
    getFirst(row, ["phone number", "mobile phone", "telephone number"]),
    defaultPhoneCode,
  );

  const firstName = getFirst(row, ["first name"]);
  const lastName = getFirst(row, ["last name"]);

  const name =
    getFirst(row, ["display name", "full name"]) ||
    [firstName, lastName].filter(Boolean).join(" ");

  const email = getFirst(row, ["user name", "email", "mail"]) || null;

  const teamsAadObjectId =
    getFirst(row, ["user id", "aad object id", "object id"]) || null;

  return {
    name: name || "",
    email,
    assistantId: assistantId ?? null,
    phoneNumber: phone.phoneNumber,
    phoneCountryCode: phone.phoneCountryCode,
    phoneNational: phone.phoneNational,
    teamsAadObjectId,
    teamsFromId: null,
  };
}
