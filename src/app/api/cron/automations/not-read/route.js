import { NextResponse } from "next/server";

import {
  processUnreadAutomations,
} from "@/lib/services/automations/unreadAutomation.service";

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
 * Processa os pedidos GET e POST do cron.
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

    let organizationId = null;

    try {
      const url = new URL(req.url);

      const rawOrganizationId =
        url.searchParams.get(
          "organizationId",
        );

      if (rawOrganizationId) {
        organizationId = Number(
          rawOrganizationId,
        );
      }
    } catch {
      // Mantém o comportamento atual:
      // ignora erros ao interpretar a URL.
    }

    const result =
      await processUnreadAutomations({
        organizationId,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[Automations][MessageUnread]",
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