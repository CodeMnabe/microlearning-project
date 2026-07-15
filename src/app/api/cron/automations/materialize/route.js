import { NextResponse } from "next/server";

import {
  processAutomationMaterialization,
} from "@/lib/services/automations/automationMaterialization.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Valida a autorização do cron.
 *
 * Mantém exatamente o comportamento anterior.
 */
function isAuthorized(req) {
  const cronSecret =
    process.env.CRON_SECRET;

  if (!cronSecret) {
    return (
      process.env.NODE_ENV !==
      "production"
    );
  }

  const authHeader =
    req.headers.get("authorization") ||
    "";

  const bearer =
    authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

  const xCronSecret =
    req.headers.get("x-cron-secret") ||
    "";

  return (
    bearer === cronSecret ||
    xCronSecret === cronSecret
  );
}

/**
 * Lê o limite enviado por GET ou POST.
 *
 * Mantém:
 * - valor padrão de 200;
 * - conversão através de Number;
 * - fallback para 200;
 * - ausência de limite máximo.
 */
async function getRequestedLimit(req) {
  let limit = 200;

  try {
    if (req.method === "POST") {
      const body = await req
        .json()
        .catch(() => ({}));

      if (body?.limit) {
        limit =
          Number(body.limit) || 200;
      }
    } else {
      const url = new URL(req.url);

      const rawLimit =
        url.searchParams.get("limit");

      if (rawLimit) {
        limit =
          Number(rawLimit) || 200;
      }
    }
  } catch {
    // Mantém o comportamento anterior:
    // qualquer erro utiliza o limite padrão.
  }

  return limit;
}

/**
 * Processa os pedidos GET e POST.
 */
async function handler(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const limit =
      await getRequestedLimit(req);

    const result =
      await processAutomationMaterialization({
        limit,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[Automations][Materialize]",
      error,
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          String(error),
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(req) {
  return handler(req);
}

export async function POST(req) {
  return handler(req);
}