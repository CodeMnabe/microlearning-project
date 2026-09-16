export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnedOrg } from "@/lib/auth/guards";
import { getAnalyticsOverview } from "@/lib/services/analytics/analytics.service";

/**
 * Endpoint principal das métricas.
 *
 * O `requireOwnedOrg` faz três coisas de uma vez, e é por isso que
 * substitui a validação manual do orgId que estava aqui:
 *
 *   400  o orgId não é um inteiro positivo
 *   401  não há sessão nos cookies do pedido
 *   403  há sessão, mas o utilizador não é dono desta organização
 *
 * O terceiro caso é o que interessa: sem ele, bastava trocar o número
 * na query string para ler as métricas de outra organização.
 *
 * Repare-se que o guard devolve o erro em vez de o lançar. Isso obriga
 * a linha `if (auth.error) return auth.error` a existir no chamador —
 * que é bom, porque torna impossível esquecer a verificação sem que se
 * veja no código.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const auth = await requireOwnedOrg(searchParams.get("orgId"));
    if (auth.error) return auth.error;

    const period = searchParams.get("period") || "all";

    const data = await getAnalyticsOverview({
      orgId: auth.orgId,
      period,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/overview] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to load analytics overview",
      },
      { status: err.status || 500 }
    );
  }
}