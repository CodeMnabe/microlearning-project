import createMiddleware from "next-intl/middleware";
import { NextResponse, NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./utils/supabase/middleware";
import {
  buildContentSecurityPolicy,
  generateNonce,
} from "./lib/security/contentSecurityPolicy";
import { getSecurityHeaders } from "./lib/security/securityHeaders";

const intl = createMiddleware(routing);

const PRIVATE_ROUTE_ROOTS = new Set([
  "admin",
  "analytics",
  "assistants",
  "automations",
  "broadcast",
  "options",
  "private",
  "templates",
  "users",
]);

function getRouteContext(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const isLocalePrefix = routing.locales.includes(segments[0]);

  const requestedLocale = isLocalePrefix ? segments[0] : routing.defaultLocale;
  const rootSegment = isLocalePrefix
    ? (segments[1] ?? "")
    : (segments[0] ?? "");

  const isApi = segments[0] === "api";
  const isAuth = rootSegment === "login" || rootSegment === "reset";
  const isTrackedLink = rootSegment === "r";
  const isPrivate = PRIVATE_ROUTE_ROOTS.has(rootSegment);

  return {
    locale: requestedLocale,
    root: rootSegment,
    isApi,
    isAuth,
    isTrackedLink,
    isPrivate,
  };
}

function copyResponseCookies(source, target) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request) {
  const isProduction = process.env.NODE_ENV === "production";
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce, isProduction);

  // 2. cria uma cópia de request.headers
  const requestHeaders = new Headers(request.headers);
  // 8 & 9. Substitui/limpa qualquer x-nonce ou CSP do request do cliente
  requestHeaders.delete("x-nonce");
  requestHeaders.delete("Content-Security-Policy");
  // 3 & 4. Define no request interno
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // We create a new request that carries the modified headers downstream.
  // Using the original request object preserves body, method, and cookies.
  const reqForPipeline = new NextRequest(request, {
    headers: requestHeaders,
  });

  const ctx = getRouteContext(request.nextUrl.pathname);

  const { response: sessionResponse, user } =
    await updateSession(reqForPipeline);

  let finalResponse;

  if (ctx.isApi) {
    finalResponse = sessionResponse;
    finalResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate",
    );
  } else {
    if (!user && ctx.isPrivate) {
      const loginUrl = reqForPipeline.nextUrl.clone();
      loginUrl.pathname =
        ctx.locale === routing.defaultLocale
          ? "/login"
          : `/${ctx.locale}/login`;
      loginUrl.search = "";
      finalResponse = copyResponseCookies(
        sessionResponse,
        NextResponse.redirect(loginUrl),
      );
    } else {
      // next-intl resolves the response
      finalResponse = copyResponseCookies(
        sessionResponse,
        intl(reqForPipeline),
      );
    }

    // Set No-Store cache control where applicable
    if (ctx.isPrivate || ctx.isAuth || ctx.isTrackedLink) {
      // Except static marketing pages, all these are sensitive
      finalResponse.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate",
      );
    }

    if (ctx.isTrackedLink) {
      finalResponse.headers.set("Referrer-Policy", "no-referrer");
    }
  }

  // 6. Define a mesma CSP na response
  finalResponse.headers.set("Content-Security-Policy", csp);

  // Applica Security Headers restantes
  const securityHeaders = getSecurityHeaders(isProduction);
  for (const [key, value] of securityHeaders) {
    if (!finalResponse.headers.has(key) || key === "Referrer-Policy") {
      finalResponse.headers.set(key, value);
    }
  }

  // 7. Não expor x-nonce na response (garantir isso)
  finalResponse.headers.delete("x-nonce");

  return finalResponse;
}

export const config = {
  // 8. RSC, Prefetch e assets excluídos:
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
