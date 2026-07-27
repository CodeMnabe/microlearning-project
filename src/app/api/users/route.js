import { NextResponse } from "next/server";

import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/services/users";
import {
  assertAssistantBelongsToOrg,
  assertTagsBelongToOrg,
  parsePositiveInt,
  parsePositiveIntArray,
  requireOrgForUser,
  requireOwnedOrg,
} from "@/lib/auth/guards";

/**
 * Rota dos utilizadores.
 *
 * Responsável apenas por:
 * - ler e validar os parâmetros do pedido;
 * - chamar o serviço de utilizadores;
 * - converter o resultado e os erros em respostas HTTP.
 *
 * As regras de negócio ficam em `@/lib/services/users`.
 */

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 100;

function parsePageParam(value, fallback, maximum = Number.POSITIVE_INFINITY) {
  if (value == null || value === "") return fallback;

  const parsed = parsePositiveInt(value);
  return parsed == null ? null : Math.min(parsed, maximum);
}

function errorResponse(error, fallbackMessage) {
  const status = Number.isInteger(error?.status) ? error.status : 500;

  if (status >= 500) console.error(error);

  return NextResponse.json(
    { error: status >= 500 ? fallbackMessage : error.message },
    { status },
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const auth = await requireOwnedOrg(searchParams.get("orgId"));
    if (auth.error) return auth.error;

    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageParam(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    if (page == null || pageSize == null) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 },
      );
    }

    const result = await listUsers({ orgId: auth.orgId, page, pageSize });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "Failed to list users.");
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (typeof body?.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      );
    }

    const auth = await requireOwnedOrg(body.organizationId);
    if (auth.error) return auth.error;

    const assistantId = await assertAssistantBelongsToOrg(
      auth.admin,
      auth.orgId,
      body.assistantId,
    );

    const newUser = await createUser({
      organizationId: auth.orgId,
      name: body.name.trim(),
      email: body.email,
      assistantId,
      phoneNumber: body.phoneNumber,
      phoneCountryCode: body.phoneCountryCode,
      phoneNational: body.phoneNational,
      teamsAadObjectId: body.teamsAadObjectId,
      teamsFromId: body.teamsFromId,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    if (error.code === "USER_LIMIT_REACHED") {
      return NextResponse.json(
        { error: "This organization has reached its user limit." },
        { status: 409 },
      );
    }

    if (error.code === "23505") {
      return NextResponse.json(
        { error: "User already exists (duplicate key)." },
        { status: 409 },
      );
    }

    return errorResponse(error, "Failed to create user.");
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();

    const auth = await requireOrgForUser(body?.id);
    if (auth.error) return auth.error;

    let assistantId = body.assistantId;
    if (assistantId !== undefined) {
      assistantId = await assertAssistantBelongsToOrg(
        auth.admin,
        auth.orgId,
        assistantId,
      );
    }

    let tagIds = body.tagIds;
    if (tagIds !== undefined) {
      tagIds = parsePositiveIntArray(tagIds);

      if (tagIds == null) {
        return NextResponse.json(
          { error: "Invalid tagIds" },
          { status: 400 },
        );
      }

      tagIds = await assertTagsBelongToOrg(auth.admin, auth.orgId, tagIds);
    }

    const updatedUser = await updateUser({
      id: auth.userId,
      name: body.name,
      email: body.email,
      assistantId,
      tagIds,
      phoneNumber: body.phoneNumber,
      phoneCountryCode: body.phoneCountryCode,
      phoneNational: body.phoneNational,
      teamsAadObjectId: body.teamsAadObjectId,
      teamsFromId: body.teamsFromId,
    });

    return NextResponse.json(updatedUser);
  } catch (err) {
    return errorResponse(err, "Failed to update user.");
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireOrgForUser(searchParams.get("id"));
    if (auth.error) return auth.error;

    await deleteUser(auth.userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, "Failed to delete user.");
  }
}
