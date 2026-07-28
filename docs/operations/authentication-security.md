# Authentication Security

## Security boundaries

The Proxy provides navigation and recovery redirects for browser pages. It is
not the authorization boundary for APIs. Every privileged API must continue to
use the backend guards before any service-role lookup.

Organization ownership is determined by the existing product relation:
`organization.owner_user_id = auth.user.id`. No role stored in user metadata is
trusted for this decision.

## PKCE and callback

- Supabase browser and SSR clients do not enable the implicit flow.
- Auth codes are exchanged server-side by `/api/auth/callback`.
- Redirect targets are restricted to validated internal paths.
- Auth codes, verifiers, tokens and complete cookie values must not be logged.
- Callback and every final response carrying `Set-Cookie` use the sensitive
  cache policy described below.

## Password reset

The reset request is a Server Action that forwards the Turnstile token to
Supabase Auth and always returns a generic public result.

The confirmation page:

- has password and confirmation fields;
- uses a minimum of 12 characters in the browser UX;
- calls only the password-change Server Action;
- does not create a Supabase browser client;
- does not read the Auth session or call `auth.updateUser()` in the browser.

The password-change Server Action:

1. creates the per-request Supabase SSR client;
2. verifies the current recovery session with `getUser()`;
3. validates both fields with the shared password policy;
4. calls `auth.updateUser({ password })` on the server;
5. returns only generic errors;
6. signs out the local browser session after success and requires a new login.

Signing out clears the local session used by the application. It does not make
already issued access tokens disappear: an access token can remain
cryptographically valid until its expiry. Hosted session settings and incident
revocation therefore remain operational controls.

## Password policy

- Minimum: 12 characters.
- Maximum: 128 UTF-8 bytes.
- Required: lowercase, uppercase, digit and symbol.
- Confirmation must match.
- Existing logins are not rejected merely because their stored password
  predates this policy.

## MFA assurance

TOTP MFA is required for organization owners.

Both values returned by Supabase are authorization inputs:

- `currentLevel` describes the assurance in the current access token;
- `nextLevel` describes the highest level currently available to the user.

In the installed client, the assurance helper can derive `nextLevel` from the
user embedded in a stale session. The application therefore also calls the
supported `mfa.listFactors()` endpoint. If no currently verified factor exists,
the effective `nextLevel` is `aal1`.

Privileged authorization requires both effective values to be `aal2`.

| currentLevel | nextLevel | Browser navigation  | Backend authorization         |
| ------------ | --------- | ------------------- | ----------------------------- |
| `aal1`       | `aal1`    | enrollment          | denied                        |
| `aal1`       | `aal2`    | challenge           | denied                        |
| `aal2`       | `aal2`    | private destination | allowed, subject to ownership |
| `aal2`       | `aal1`    | enrollment          | denied                        |

The last state can occur when a factor is removed while an access token still
contains AAL2. It is treated as stale and is never privileged.

The Proxy performs these redirects for private browser pages and preserves only
a validated internal `next` path. Login, callback, reset, enrollment, challenge
and signout remain reachable so that recovery cannot enter a redirect loop.

Backend guards repeat the AAL check before the first administrative lookup.
Public properties, user metadata and app metadata cannot replace the private
validated marker used inside one request.

## MFA recovery

The installed Supabase client supports:

```js
supabase.auth.admin.mfa.deleteFactor({
  userId,
  id,
});
```

Factor deletion must be recorded by the Auth audit trail and the operational
recovery record. Deletion alone is not proof that all issued access tokens were
revoked.

After deletion:

1. the application rejects `aal2/aal1` immediately;
2. refresh must not restore privileged application access;
3. the next login starts at AAL1;
4. the Proxy sends the owner to enrollment;
5. a new factor is required.

Where an officially supported hosted session-revocation mechanism is enabled,
use it in addition to factor deletion. Do not create bypass codes. A shorter
hosted JWT lifetime is recommended for privileged accounts to reduce the
remaining lifetime of stale tokens.

## Resource confidentiality

For resources addressed by ID, a missing resource and a resource owned by a
different tenant have the same public result:

- status `404`;
- body `{ "error": "Resource not found" }`;
- no organization or table details.

Internal structured events distinguish `not_found`, `cross_tenant` and database
lookup failures. AAL1 is still rejected before the resource lookup, and AAL2
does not replace the ownership check.

Endpoints that explicitly receive an organization ID keep their existing
organization-level semantics.

## Cache policy

Sensitive responses use:

```text
private, no-store, no-cache, must-revalidate
```

This applies to callback, login, reset, reset confirmation, MFA pages, private
pages, signout, APIs and any final Proxy response carrying `Set-Cookie`.
Sensitive responses must not contain `public`, `s-maxage` or
`stale-while-revalidate`.

Static assets are excluded by the Proxy matcher and are not assigned this
policy.

## CAPTCHA

Login and reset pass the widget token intact to Supabase Auth. The application
does not call Cloudflare Siteverify before those Auth operations. Tokens are
cleared after an attempt and must never be logged.

Local GoTrue can run with CAPTCHA disabled to validate the forwarding contract,
but this does not prove hosted Turnstile validation.

## Rate limiting

- Persistent capacity is evaluated in the order global, IP, opaque identity.
- A rejected earlier scope short-circuits later bucket creation.
- Login and reset use distinct scopes.
- Email addresses are represented by opaque keyed identities.
- Rate-limited responses include a retry delay.

## Logging

Authentication logs are structured and schema-bound. Never log email,
password, CAPTCHA token, authorization code, code verifier, access token,
refresh token, complete cookie, OTP, TOTP secret, TOTP URI or a sensitive URL.

## Hosted gates

The following controls cannot be concluded from local validation and must be
verified in the hosted environment:

- Supabase Auth CAPTCHA enabled with the correct Turnstile secret;
- allowed Turnstile domains;
- exact production Site URL and redirect allowlist;
- leaked-password protection;
- custom SMTP and email templates;
- hosted Auth rate limits;
- JWT lifetime, with a shorter lifetime considered for privileged accounts;
- single-session policy;
- refresh-token reuse protection;
- supported hosted session revocation;
- CDN/Vercel cache behavior for final responses.

## Local validation

Os artefactos de validação runtime permanecem fora do controlo de versão. Do
not change the versioned migration to make the harness start.

Validate at minimum:

- reset email, callback, code exchange and replay;
- password confirmation and server-only update;
- MFA enrollment and challenge;
- all four `currentLevel`/`nextLevel` combinations;
- stale session immediately after factor deletion;
- direct API guards before administrative lookups;
- cross-tenant and missing-resource equivalence;
- final response cache headers;
- logout and independent cookie jars.
