export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { importUsers } from "@/lib/services/users";
import { requireOwnedOrg } from "@/lib/auth/guards";

/**
 * Rota de importação de utilizadores.
 *
 * Responsável apenas por validar o pedido, chamar o serviço e converter
 * o resultado em resposta HTTP.
 *
 * As regras da importação ficam em `usersImport.service`.
 */

export async function POST(req) {
  try {
    const { organizationId, users } = await req.json();

    if (!organizationId || !Array.isArray(users)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const auth = await requireOwnedOrg(organizationId);
    if (auth.error) return auth.error;

    const summary = await importUsers({ orgId: auth.orgId, users });

    return NextResponse.json(summary);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error(error);

    return NextResponse.json(
      {
        error:
          status >= 500 ? "Import failed: " + error.message : error.message,
      },
      { status },
    );
  }
}
