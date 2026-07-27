import { NextResponse } from "next/server";

import { BULK_TAG_OPERATIONS, bulkModifyTags } from "@/lib/services/users";
import {
  assertTagsBelongToOrg,
  assertUsersBelongToOrg,
  parsePositiveIntArray,
  requireOwnedOrg,
} from "@/lib/auth/guards";

/**
 * Rota da alteração de tags em massa.
 *
 * Responsável apenas por validar o pedido, chamar o serviço e converter
 * o resultado em resposta HTTP.
 *
 * Depois da autorização, a operação usa o cliente administrativo recebido
 * do guard, apenas com utilizadores e tags previamente validados.
 */

const SUPPORTED_OPERATIONS = Object.values(BULK_TAG_OPERATIONS);

export async function POST(req) {
  try {
    const {
      ids = [],
      tagIds = [],
      op = BULK_TAG_OPERATIONS.ADD,
      orgId,
    } = await req.json();

    const userIds = parsePositiveIntArray(ids);
    const numericTagIds = parsePositiveIntArray(tagIds);

    if (!userIds?.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    if (
      numericTagIds == null ||
      (!numericTagIds.length && op !== BULK_TAG_OPERATIONS.SET)
    ) {
      return NextResponse.json({ error: "tagIds required" }, { status: 400 });
    }

    if (!SUPPORTED_OPERATIONS.includes(op)) {
      return NextResponse.json({ error: "invalid op" }, { status: 400 });
    }

    const auth = await requireOwnedOrg(orgId);
    if (auth.error) return auth.error;

    const authorizedUserIds = await assertUsersBelongToOrg(
      auth.admin,
      auth.orgId,
      userIds,
    );
    const authorizedTagIds = await assertTagsBelongToOrg(
      auth.admin,
      auth.orgId,
      numericTagIds,
    );

    await bulkModifyTags(auth.admin, {
      userIds: authorizedUserIds,
      tagIds: authorizedTagIds,
      op,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    return NextResponse.json({ error: error.message }, { status });
  }
}
