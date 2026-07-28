export const AUTH_RATE_LIMITS = Object.freeze({
  loginGlobal: Object.freeze({
    scope: "auth-login-global",
    windowSeconds: 60,
    maximumRequests: 60,
  }),
  loginIp: Object.freeze({
    scope: "auth-login-ip",
    windowSeconds: 300,
    maximumRequests: 10,
  }),
  loginAccount: Object.freeze({
    scope: "auth-login-account",
    windowSeconds: 900,
    maximumRequests: 5,
  }),
  resetGlobal: Object.freeze({
    scope: "auth-reset-global",
    windowSeconds: 60,
    maximumRequests: 30,
  }),
  resetIp: Object.freeze({
    scope: "auth-reset-ip",
    windowSeconds: 300,
    maximumRequests: 5,
  }),
  resetAccount: Object.freeze({
    scope: "auth-reset-account",
    windowSeconds: 3600,
    maximumRequests: 3,
  }),
});

export const AUTH_BODY_MAX_BYTES = 4096;
