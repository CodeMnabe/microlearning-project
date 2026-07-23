# Public request abuse controls

This runbook covers the public contact form and tracked-link resolution. The
database migration must be applied before application code is deployed because
the routes call service-role-only RPCs.

## Required configuration

Set all values explicitly in each environment. The application does not create
or silently substitute secrets or commercial policy values.

- `ABUSE_IDENTITY_SECRET`: random server-only secret of at least 32 bytes. Do
  not prefix it with `NEXT_PUBLIC_`.
- `TRUSTED_PROXY_MODE`: `vercel` only after confirming that the deployment edge
  overwrites `x-forwarded-for`; `single` only behind a controlled single proxy
  that overwrites `x-real-ip`. Any other value treats the address as unavailable.
- `TURNSTILE_SECRET_KEY`: server-only Turnstile secret.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: public widget site key.
- `TURNSTILE_EXPECTED_ACTION` and `NEXT_PUBLIC_TURNSTILE_ACTION`: the same
  explicit action, normally `contact`.
- `TURNSTILE_ALLOWED_HOSTNAMES`: comma-separated exact lowercase hostnames.
- `TRACKED_LINK_TTL_SECONDS`: normal link lifetime, from 60 seconds through the
  technical hard maximum of 7,776,000 seconds (90 days).
- `TRACKED_LINK_REFERER_ORIGINS`: optional comma-separated exact origins. An
  unlisted referer is discarded; paths and query strings are never stored.
- `TRACKED_LINK_EVENT_RETENTION_DAYS`: 1–3650.
- `TRACKED_LINK_EXPIRED_LINK_GRACE_DAYS`: 1–365.
- `PUBLIC_ABUSE_CLEANUP_BATCH_SIZE`: 1–1000.
- `CRON_SECRET`: protects the cleanup route.

Turnstile, the proxy/WAF, Vercel, Supabase deployment settings, cron execution,
alerts and dashboards have not been verified by this repository change.

## Technical limits

Contact JSON is limited to 16 KiB before parsing. Name is 2–120 characters,
email 3–254, company 0–160 and message 10–4000. The route accepts only those
fields plus the ephemeral CAPTCHA token.

Contact capacity is 120 requests/minute globally, 5/10 minutes per opaque IP
identity and 3/hour per opaque normalized email. Identical content is written at
most once per 10-minute bucket. These are technical safety defaults, not plan or
commercial quotas.

Tracked-link resolution is limited separately by global, token and visitor
scopes. GET never records a click. Browser interaction uses an encrypted,
authenticated five-minute context and a POST; click events deduplicate for 30
minutes. HEAD, preview clients, scanners and requests without a valid context do
not count. Analytics limits suppress the write but do not prevent a valid GET
from returning its destination.

The database enforces a maximum rate-limit window of 24 hours and maximum count
of 10,000 per bucket. All counters are atomic and service-role-only.

## Retention and cleanup

`POST /api/cron/public-abuse-cleanup` runs in bounded batches and deletes expired
capacity buckets, expired contact fingerprints, old click events, and links past
their configured expiry/revocation grace period. The Vercel schedule is declared
daily at 01:30 UTC, but its external activation must be confirmed.

The limiter stores only HMAC identities. CAPTCHA tokens and tracked-link tokens
are never stored in the new control tables. Click events store an enumerated
client class and, when allowlisted, only a referer origin. The expansive
migration preserves the legacy `ip_hash`, `user_agent` and `referer` columns so
that instances still running previous code continue to function during rollout.

## Revocation and secret rotation

Revoke a link by setting `tracked_link.revoked_at` through an authenticated,
organization-owned operational path. No browser-supplied recipient or
organization value is accepted by click analytics. A management UI/API for this
operation is not introduced here; until one is approved, use a reviewed
service-role administrative procedure with tenant ownership verification.

If `ABUSE_IDENTITY_SECRET` is exposed, replace it with a new strong secret and
redeploy all instances together. Existing rate buckets and dedupe identities
will no longer correlate; monitor the temporary reset in limits. Encrypted
interaction contexts issued under the old secret become invalid within five
minutes. Do not retain the old secret as a fallback.

## Rollout gates

1. Run the disposable PostgreSQL validation and application test suite.
2. Preflight every existing tracked link. `expires_at IS NULL` fails closed after
   deployment; decide and explicitly set an approved expiry or revoke the link.
3. Confirm the strong HMAC secret is present in every application and worker.
4. Confirm Turnstile site/secret keys, exact action and hostname allowlist.
5. Confirm the proxy overwrites the configured client-address header; otherwise
   leave the mode unset and expect the conservative shared-IP bucket.
6. Approve the normal TTL, retention, cleanup batch and rate limits.
7. Apply `20260722180000_public_request_abuse_controls.sql`. This is the
   expansive migration: it adds the minimized columns and leaves the legacy
   event columns (`ip_hash`, `user_agent`, `referer`) available for instances
   still running the previous code.
8. Deploy the new application code everywhere.
9. Confirm operationally that no older instance still reads or writes
   `ip_hash`, `user_agent` or `referer`.
10. Only after that confirmation, create a new PR with a new forward-only
    migration that drops the legacy columns. Do not reuse a migration from
    this deployment. The new migration must be reviewed, approved, and
    deployed independently.
11. Confirm the cleanup cron, abuse alerts and dashboards externally.
12. Test revocation and the documented compromised-secret response in staging.
