import { NextResponse } from "next/server";

import { bulkDeleteUsers, bulkSetAssistant } from "@/lib/services/users";
import {
  assertAssistantBelongsToOrg,
  assertUsersBelongToOrg,
  parsePositiveIntArray,
  requireOwnedOrg,
} from "@/lib/auth/guards";

/**
 * Rota das ações em massa sobre utilizadores.
 *
 * Responsável apenas por validar o pedido, chamar o serviço e converter
 * o resultado em resposta HTTP.
 *
 * Antes de chamar o serviço, confirma que a organização, os utilizadores e
 * o assistente pertencem todos ao utilizador autenticado.
 */

export async function PATCH(req) {
  try {
    const { ids, assistantId, orgId } = await req.json();
    const userIds = parsePositiveIntArray(ids);

    if (!userIds?.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    if (assistantId === undefined) {
      return NextResponse.json(
        { error: "assistantId required" },
        { status: 400 },
      );
    }

    const auth = await requireOwnedOrg(orgId);
    if (auth.error) return auth.error;

    const authorizedUserIds = await assertUsersBelongToOrg(
      auth.admin,
      auth.orgId,
      userIds,
    );
    const authorizedAssistantId = await assertAssistantBelongsToOrg(
      auth.admin,
      auth.orgId,
      assistantId,
    );

    await bulkSetAssistant({
      userIds: authorizedUserIds,
      assistantId: authorizedAssistantId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(req) {
  try {
    const { ids, orgId } = await req.json();
    const userIds = parsePositiveIntArray(ids);

    if (!userIds?.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const auth = await requireOwnedOrg(orgId);
    if (auth.error) return auth.error;

    const authorizedUserIds = await assertUsersBelongToOrg(
      auth.admin,
      auth.orgId,
      userIds,
    );

    const summary = await bulkDeleteUsers({ userIds: authorizedUserIds });

    return NextResponse.json(summary);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    return NextResponse.json({ error: error.message }, { status });
  }
}
