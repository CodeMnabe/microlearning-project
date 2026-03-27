import { NextResponse } from "next/server";
import { createUser, getUsersInOrg } from "@/lib/repos/user.repo";

function cleanText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function cleanEmail(value) {
  const email = cleanText(value).toLowerCase();
  return email || null;
}

function cleanDigits(value) {
  return cleanText(value).replace(/\D/g, "");
}

function buildFullPhone({ phoneNumber, phoneCountryCode, phoneNational }) {
  const explicit = cleanText(phoneNumber);
  if (explicit) return explicit;

  const code = cleanText(phoneCountryCode);
  const national = cleanDigits(phoneNational);

  if (code && national) {
    return `${code}${national}`;
  }

  return null;
}

export async function POST(req) {
  try {
    const { organizationId, users } = await req.json();

    if (!organizationId || !Array.isArray(users)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const orgId = Number(organizationId);

    if (!orgId) {
      return NextResponse.json(
        { error: "Invalid organizationId" },
        { status: 400 },
      );
    }

    const existingUsersResult = await getUsersInOrg(orgId, {
      page: 1,
      pageSize: 1000,
    });
    const existingUsers = existingUsersResult.items || [];

    const existingEmails = new Set(
      (existingUsers || []).map((u) => cleanEmail(u.email)).filter(Boolean),
    );

    const existingAadIds = new Set(
      (existingUsers || [])
        .map((u) => cleanText(u.teams_aad_object_id))
        .filter(Boolean),
    );

    const existingPhone = new Set(
      (existingUsers || [])
        .map((u) => cleanText(u.phone_number))
        .filter(Boolean),
    );

    const seenEmails = new Set();
    const seenAadIds = new Set();
    const seenPhones = new Set();

    const skippedRows = [];
    const toCreate = [];

    users.forEach((rawUser, index) => {
      const rowNumber = index + 1;

      const name = cleanText(rawUser.name);
      const email = cleanEmail(rawUser.email);
      const teamsAadObjectId = cleanText(rawUser.teamsAadObjectId) || null;
      const teamsFromId = cleanText(rawUser.teamsFromId) || null;

      const phoneCountryCode = cleanText(rawUser.phoneCountryCode) || null;
      const phoneNational = cleanText(rawUser.phoneNational) || null;
      const phoneNumber = buildFullPhone({
        phoneNumber: rawUser.phoneNumber,
        phoneCountryCode,
        phoneNational,
      });

      const assistantId =
        rawUser.assistantId === "" || rawUser.assistantId == null
          ? null
          : Number(rawUser.assistantId);

      if (!name) {
        skippedRows.push({
          row: rowNumber,
          name: "",
          reason: "Missing name",
        });
        return;
      }

      if (!email && !teamsAadObjectId && !phoneNumber) {
        skippedRows.push({
          row: rowNumber,
          name,
          reason: "No email, Teams AAD Object ID, or phone number found",
        });
        return;
      }

      if (email && (existingEmails.has(email) || seenEmails.has(email))) {
        skippedRows.push({
          row: rowNumber,
          name,
          reason: "Duplicate email",
        });
        return;
      }

      if (
        teamsAadObjectId &&
        (existingAadIds.has(teamsAadObjectId) ||
          seenAadIds.has(teamsAadObjectId))
      ) {
        skippedRows.push({
          row: rowNumber,
          name,
          reason: "Duplicate Teams AAD Object ID",
        });
        return;
      }

      if (
        phoneNumber &&
        (existingPhone.has(phoneNumber) || seenPhones.has(phoneNumber))
      ) {
        skippedRows.push({
          row: rowNumber,
          name,
          reason: "Duplicate phone number",
        });
        return;
      }

      if (email) seenEmails.add(email);
      if (teamsAadObjectId) seenAadIds.add(teamsAadObjectId);
      if (phoneNumber) seenPhones.add(phoneNumber);

      toCreate.push({
        organizationId: orgId,
        name,
        email,
        assistantId,
        phoneNumber: phoneNumber || undefined,
        phoneCountryCode: phoneCountryCode || undefined,
        phoneNational: phoneNational || undefined,
        teamsAadObjectId,
        teamsFromId,
        __row: rowNumber,
      });
    });

    const results = await Promise.allSettled(
      toCreate.map((user) =>
        createUser({
          organizationId: user.organizationId,
          name: user.name,
          email: user.email,
          assistantId: user.assistantId,
          phoneNumber: user.phoneNumber,
          phoneCountryCode: user.phoneCountryCode,
          phoneNational: user.phoneNational,
          teamsAadObjectId: user.teamsAadObjectId,
          teamsFromId: user.teamsFromId,
        }),
      ),
    );

    const failedRows = [];
    let created = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        created += 1;
        return;
      }

      const source = toCreate[index];
      const message =
        result.reason?.message ||
        result.reason?.error_description ||
        "Failed to create user";

      failedRows.push({
        row: source.__row,
        name: source.name,
        reason: message,
      });
    });

    return NextResponse.json({
      totalReceived: users.length,
      created,
      skipped: skippedRows.length,
      failed: failedRows.length,
      skippedRows,
      failedRows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Import failed: " + error.message },
      { status: 500 },
    );
  }
}
