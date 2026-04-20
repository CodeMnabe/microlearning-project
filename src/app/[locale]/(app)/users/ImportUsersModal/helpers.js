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

function getValue(row, keys = []) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

export default function mapCsvRow(
  row,
  defaultPhoneCode = "+351",
  forcedAssistantId = null,
) {
  const name = getValue(row, ["name", "Name"]);
  const email = getValue(row, ["email", "Email"]).toLowerCase();

  const rawPhoneCountryCode = getValue(row, ["phone_country_code"]);

  const rawPhone = getValue(row, [
    "phone_number",
    "phone",
    "Phone",
    "Phone Number",
    "phoneNumber",
  ]);

  const teamsAadObjectId = getValue(row, [
    "teams_aad_object_id",
    "teamsAadObjectId",
    "Teams AAD Object ID",
    "teams_aad",
  ]);

  const assistantIdFromCsv = getValue(row, [
    "assistant_id",
    "assistantId",
    "Assistant ID",
  ]);

  const assistantPositionFromCsv = getValue(row, [
    "assistant_position",
    "assistantPosition",
    "Assistant Position",
  ]);

  const phoneCountryCode =
    cleanValue(rawPhoneCountryCode) || defaultPhoneCode || "";
  console.log(phoneCountryCode);

  let phoneNumber = rawPhone;
  let fullPhoneNumber;

  if (phoneNumber && !phoneNumber.startsWith("+")) {
    const digits = phoneNumber.replace(/\D/g, "");
    fullPhoneNumber = digits ? `${defaultPhoneCode}${digits}` : "";
  }
  return {
    name,
    email: email || null,
    phoneCountryCode: phoneCountryCode || null,
    phoneNational: phoneNumber || null,
    phoneNumber: fullPhoneNumber || null,
    teamsAadObjectId: teamsAadObjectId || null,
    assistantId: forcedAssistantId || assistantIdFromCsv || null,
    assistantPosition: assistantPositionFromCsv || null,
  };
}
