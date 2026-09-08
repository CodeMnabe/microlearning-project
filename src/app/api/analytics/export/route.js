export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnedOrg } from "@/lib/auth/guards";
import { getAnalyticsExportDataset } from "@/lib/services/analytics/analyticsExport.service";

/**
 * Endpoint do dataset de detalhe da exportação.
 *
 * A verificação vem primeiro e não é opcional: ao contrário da
 * `overview`, que só devolve contagens, esta route devolve nomes,
 * emails e telefones de pessoas. É o mesmo guard, pela mesma razão de
 * sempre — só que aqui o custo de o esquecer seria muito maior.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const auth = await requireOwnedOrg(searchParams.get("orgId"));
    if (auth.error) return auth.error;

    const period = searchParams.get("period") || "all";

    const data = await getAnalyticsExportDataset({
      orgId: auth.orgId,
      period,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/export] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to build analytics export",
      },
      { status: err.status || 500 },
    );
  }
}
