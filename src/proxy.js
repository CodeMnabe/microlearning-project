import createMiddleware from "next-intl/middleware";
import { NextResponse, NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./utils/supabase/middleware";
import {
  buildContentSecurityPolicy,
  generateNonce,
} from "./lib/security/contentSecurityPolicy";
import { getSecurityHeaders } from "./lib/security/securityHeaders";
import { getMfaStatus } from "./lib/auth/mfa";
import { getSafeRedirectPath } from "./lib/auth/redirectValidation";
import { applySensitiveCacheControl } from "./lib/security/cacheControl";

const intl = createMiddleware(routing);
const intlWithExplicitLocale = createMiddleware({
  ...routing,
  localePrefix: "always",
});

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
  const isAuthCallback =
    isApi && segments[1] === "auth" && segments[2] === "callback";
  const isAuth = rootSegment === "login" || rootSegment === "reset";
  const isMfaEnrollment =
    rootSegment === "mfa" && segments[isLocalePrefix ? 2 : 1] === "enrollment";
  const isMfaChallenge =
    rootSegment === "mfa" && segments[isLocalePrefix ? 2 : 1] === "challenge";
  const isMfa = isMfaEnrollment || isMfaChallenge;
  const isTrackedLink = rootSegment === "r";
  const isPrivate = PRIVATE_ROUTE_ROOTS.has(rootSegment);

  return {
    locale: requestedLocale,
    hasLocalePrefix: isLocalePrefix,
    root: rootSegment,
    isApi,
    isAuthCallback,
    isAuth,
    isMfa,
    isMfaEnrollment,
    isMfaChallenge,
    isTrackedLink,
    isPrivate,
  };
}

function copyResponseCookies(source, target) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function getLocalizedPath(ctx, path) {
  if (ctx.hasLocalePrefix || ctx.locale !== routing.defaultLocale) {
    return `/${ctx.locale}${path}`;
  }

  return path;
}

function createAuthRedirect(request, sessionResponse, ctx, pathname, nextPath) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = getLocalizedPath(ctx, pathname);
  redirectUrl.search = "";
  redirectUrl.hash = "";

  if (nextPath) {
    const safeNext = getSafeRedirectPath(nextPath, null);
    if (safeNext) redirectUrl.searchParams.set("next", safeNext);
  }

  return copyResponseCookies(
    sessionResponse,
    NextResponse.redirect(redirectUrl),
  );
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

  let sessionResponse;
  let user = null;
  let supabase = null;

  if (ctx.isAuthCallback) {
    sessionResponse = NextResponse.next({
      request: {
        headers: reqForPipeline.headers,
      },
    });
  } else {
    ({
      response: sessionResponse,
      user,
      supabase,
    } = await updateSession(reqForPipeline));
  }

  let finalResponse;

  if (ctx.isApi) {
    finalResponse = sessionResponse;
  } else {
    if (!user && ctx.isPrivate) {
      finalResponse = createAuthRedirect(
        reqForPipeline,
        sessionResponse,
        ctx,
        "/login",
        reqForPipeline.nextUrl.pathname,
      );
    } else if (user && ctx.isPrivate) {
      try {
        const mfaStatus = await getMfaStatus(supabase, user.id);

        if (mfaStatus.requiresEnrollment) {
          finalResponse = createAuthRedirect(
            reqForPipeline,
            sessionResponse,
            ctx,
            "/mfa/enrollment",
            reqForPipeline.nextUrl.pathname,
          );
        } else if (mfaStatus.requiresChallenge) {
          finalResponse = createAuthRedirect(
            reqForPipeline,
            sessionResponse,
            ctx,
            "/mfa/challenge",
            reqForPipeline.nextUrl.pathname,
          );
        }
      } catch {
        finalResponse = createAuthRedirect(
          reqForPipeline,
          sessionResponse,
          ctx,
          "/login",
          reqForPipeline.nextUrl.pathname,
        );
      }
    }

    if (!finalResponse) {
      const localeMiddleware =
        ctx.hasLocalePrefix && (ctx.isPrivate || ctx.isAuth || ctx.isMfa)
          ? intlWithExplicitLocale
          : intl;
      finalResponse = copyResponseCookies(
        sessionResponse,
        localeMiddleware(reqForPipeline),
      );
    }

    if (ctx.isTrackedLink) {
      finalResponse.headers.set("Referrer-Policy", "no-referrer");
    }
  }

  if (
    ctx.isApi ||
    ctx.isPrivate ||
    ctx.isAuth ||
    ctx.isMfa ||
    ctx.isTrackedLink ||
    finalResponse.headers.has("Set-Cookie")
  ) {
    applySensitiveCacheControl(finalResponse);
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
