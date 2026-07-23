BEGIN;

LOCK TABLE public.contact IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.tracked_link IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.tracked_link_event IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_invalid bigint;
BEGIN
  SELECT count(*) INTO v_invalid
  FROM public.contact
  WHERE char_length(btrim(name)) NOT BETWEEN 2 AND 120
     OR char_length(btrim(email)) NOT BETWEEN 3 AND 254
     OR (company IS NOT NULL AND char_length(btrim(company)) > 160)
     OR char_length(btrim(message)) NOT BETWEEN 10 AND 4000;
  IF v_invalid > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('Contact constraints preflight failed: %s row(s) require cleanup', v_invalid);
  END IF;

  SELECT count(*) INTO v_invalid
  FROM public.tracked_link AS link
  JOIN public."user" AS recipient ON recipient.id = link.recipient_user_id
  WHERE link.recipient_user_id IS NOT NULL
    AND recipient.organization_id <> link.org_id;
  IF v_invalid > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = format('Tracked link recipient preflight failed: %s cross-tenant row(s) require cleanup', v_invalid);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.request_capacity_bucket (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT request_capacity_bucket_pkey PRIMARY KEY (scope, subject_hash, window_started_at),
  CONSTRAINT request_capacity_bucket_scope_check CHECK (scope ~ '^[a-z][a-z0-9-]{1,63}$'),
  CONSTRAINT request_capacity_bucket_subject_check CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT request_capacity_bucket_window_check CHECK (window_seconds BETWEEN 1 AND 86400),
  CONSTRAINT request_capacity_bucket_count_check CHECK (request_count BETWEEN 0 AND 10000),
  CONSTRAINT request_capacity_bucket_expiry_check CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS request_capacity_bucket_cleanup_idx
  ON public.request_capacity_bucket (expires_at);

CREATE TABLE IF NOT EXISTS public.contact_submission_dedupe (
  fingerprint text NOT NULL,
  window_started_at timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  contact_id bigint REFERENCES public.contact(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT contact_submission_dedupe_pkey PRIMARY KEY (fingerprint, window_started_at),
  CONSTRAINT contact_submission_dedupe_fingerprint_check CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT contact_submission_dedupe_window_check CHECK (window_seconds BETWEEN 60 AND 86400),
  CONSTRAINT contact_submission_dedupe_expiry_check CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS contact_submission_dedupe_cleanup_idx
  ON public.contact_submission_dedupe (expires_at);

ALTER TABLE public.tracked_link
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE public.tracked_link_event
  ADD COLUMN IF NOT EXISTS organization_id bigint,
  ADD COLUMN IF NOT EXISTS recipient_user_id bigint,
  ADD COLUMN IF NOT EXISTS visitor_hash text,
  ADD COLUMN IF NOT EXISTS client_classification text,
  ADD COLUMN IF NOT EXISTS referer_origin text,
  ADD COLUMN IF NOT EXISTS dedupe_window_started_at timestamptz;

UPDATE public.tracked_link_event AS event
SET organization_id = link.org_id,
    recipient_user_id = link.recipient_user_id
FROM public.tracked_link AS link
WHERE event.tracked_link_id = link.id
  AND (event.organization_id IS NULL OR event.recipient_user_id IS DISTINCT FROM link.recipient_user_id);

ALTER TABLE public.tracked_link_event
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.contact'::pg_catalog.regclass
      AND conname = 'contact_bounded_text_check'
  ) THEN
    ALTER TABLE public.contact ADD CONSTRAINT contact_bounded_text_check CHECK (
      char_length(btrim(name)) BETWEEN 2 AND 120
      AND char_length(btrim(email)) BETWEEN 3 AND 254
      AND (company IS NULL OR char_length(btrim(company)) <= 160)
      AND char_length(btrim(message)) BETWEEN 10 AND 4000
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tracked_link'::pg_catalog.regclass
      AND conname = 'tracked_link_lifecycle_check'
  ) THEN
    ALTER TABLE public.tracked_link ADD CONSTRAINT tracked_link_lifecycle_check CHECK (
      (expires_at IS NULL OR (expires_at > created_at AND expires_at <= created_at + interval '90 days'))
      AND (revoked_at IS NULL OR revoked_at >= created_at)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tracked_link_event'::pg_catalog.regclass
      AND conname = 'tracked_link_event_minimized_check'
  ) THEN
    ALTER TABLE public.tracked_link_event ADD CONSTRAINT tracked_link_event_minimized_check CHECK (
      (visitor_hash IS NULL OR visitor_hash ~ '^[0-9a-f]{64}$')
      AND (client_classification IS NULL OR client_classification IN ('browser', 'preview', 'scanner', 'unknown'))
      AND (referer_origin IS NULL OR (char_length(referer_origin) <= 255 AND referer_origin ~ '^https?://[^/?#]+$'))
    );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS tracked_link_id_org_unique
  ON public.tracked_link (id, org_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_id_organization_unique
  ON public."user" (id, organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tracked_link'::pg_catalog.regclass
      AND conname = 'tracked_link_recipient_organization_fkey'
  ) THEN
    ALTER TABLE public.tracked_link
      ADD CONSTRAINT tracked_link_recipient_organization_fkey
      FOREIGN KEY (recipient_user_id, org_id)
      REFERENCES public."user" (id, organization_id)
      ON DELETE SET NULL (recipient_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tracked_link_event'::pg_catalog.regclass
      AND conname = 'tracked_link_event_link_organization_fkey'
  ) THEN
    ALTER TABLE public.tracked_link_event
      ADD CONSTRAINT tracked_link_event_link_organization_fkey
      FOREIGN KEY (tracked_link_id, organization_id)
      REFERENCES public.tracked_link (id, org_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tracked_link_event'::pg_catalog.regclass
      AND conname = 'tracked_link_event_recipient_organization_fkey'
  ) THEN
    ALTER TABLE public.tracked_link_event
      ADD CONSTRAINT tracked_link_event_recipient_organization_fkey
      FOREIGN KEY (recipient_user_id, organization_id)
      REFERENCES public."user" (id, organization_id)
      ON DELETE SET NULL (recipient_user_id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS tracked_link_event_dedupe_unique
  ON public.tracked_link_event (
    tracked_link_id,
    visitor_hash,
    coalesce(recipient_user_id, '-1'::bigint),
    event_type,
    dedupe_window_started_at
  )
  WHERE visitor_hash IS NOT NULL AND dedupe_window_started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS tracked_link_lifecycle_idx
  ON public.tracked_link (expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS tracked_link_event_cleanup_idx
  ON public.tracked_link_event (created_at);

CREATE OR REPLACE FUNCTION public.consume_request_capacity(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer,
  p_maximum_requests integer
)
RETURNS TABLE(accepted boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY INVOKER
VOLATILE
PARALLEL UNSAFE
CALLED ON NULL INPUT
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window timestamptz;
  v_count integer;
  v_expiry timestamptz;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'request capacity is restricted to service_role';
  END IF;
  IF p_scope !~ '^[a-z][a-z0-9-]{1,63}$'
     OR p_subject_hash !~ '^[0-9a-f]{64}$'
     OR p_window_seconds NOT BETWEEN 1 AND 86400
     OR p_maximum_requests NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'request capacity parameters are invalid';
  END IF;

  v_window := pg_catalog.to_timestamp(
    pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / p_window_seconds) * p_window_seconds
  );
  v_expiry := v_window + pg_catalog.make_interval(secs => p_window_seconds);

  INSERT INTO public.request_capacity_bucket(
    scope, subject_hash, window_started_at, window_seconds, request_count, expires_at
  ) VALUES (p_scope, p_subject_hash, v_window, p_window_seconds, 0, v_expiry)
  ON CONFLICT (scope, subject_hash, window_started_at) DO NOTHING;

  SELECT bucket.request_count INTO v_count
  FROM public.request_capacity_bucket AS bucket
  WHERE bucket.scope = p_scope
    AND bucket.subject_hash = p_subject_hash
    AND bucket.window_started_at = v_window
  FOR UPDATE;

  retry_after_seconds := greatest(
    1,
    pg_catalog.ceil(pg_catalog.date_part('epoch', v_expiry - v_now))::integer
  );
  IF v_count >= p_maximum_requests THEN
    accepted := false;
    remaining := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  v_count := v_count + 1;
  UPDATE public.request_capacity_bucket
  SET request_count = v_count, updated_at = v_now
  WHERE scope = p_scope
    AND subject_hash = p_subject_hash
    AND window_started_at = v_window;
  accepted := true;
  remaining := p_maximum_requests - v_count;
  RETURN NEXT;
END
$$;

CREATE OR REPLACE FUNCTION public.create_deduplicated_contact(
  p_name text,
  p_email text,
  p_company text,
  p_message text,
  p_fingerprint text,
  p_window_seconds integer
)
RETURNS TABLE(accepted boolean, contact_id bigint)
LANGUAGE plpgsql
SECURITY INVOKER
VOLATILE
PARALLEL UNSAFE
CALLED ON NULL INPUT
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window timestamptz;
  v_claimed text;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'contact creation is restricted to service_role';
  END IF;
  IF char_length(btrim(p_name)) NOT BETWEEN 2 AND 120
     OR char_length(btrim(p_email)) NOT BETWEEN 3 AND 254
     OR (p_company IS NOT NULL AND char_length(btrim(p_company)) > 160)
     OR char_length(btrim(p_message)) NOT BETWEEN 10 AND 4000
     OR p_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_window_seconds NOT BETWEEN 60 AND 86400 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'contact submission parameters are invalid';
  END IF;

  v_window := pg_catalog.to_timestamp(
    pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / p_window_seconds) * p_window_seconds
  );
  INSERT INTO public.contact_submission_dedupe(
    fingerprint, window_started_at, window_seconds, expires_at
  ) VALUES (
    p_fingerprint, v_window, p_window_seconds,
    v_window + pg_catalog.make_interval(secs => p_window_seconds)
  )
  ON CONFLICT (fingerprint, window_started_at) DO NOTHING
  RETURNING fingerprint INTO v_claimed;

  IF v_claimed IS NULL THEN
    SELECT dedupe.contact_id INTO contact_id
    FROM public.contact_submission_dedupe AS dedupe
    WHERE dedupe.fingerprint = p_fingerprint
      AND dedupe.window_started_at = v_window;
    accepted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.contact(name, email, company, message, status, source)
  VALUES (btrim(p_name), lower(btrim(p_email)), nullif(btrim(p_company), ''), btrim(p_message), 'new', 'landing_page')
  RETURNING id INTO contact_id;
  UPDATE public.contact_submission_dedupe
  SET contact_id = create_deduplicated_contact.contact_id
  WHERE fingerprint = p_fingerprint AND window_started_at = v_window;
  accepted := true;
  RETURN NEXT;
END
$$;

CREATE OR REPLACE FUNCTION public.record_tracked_link_interaction(
  p_tracked_link_id uuid,
  p_visitor_hash text,
  p_token_hash text,
  p_recipient_user_id bigint,
  p_client_classification text,
  p_referer_origin text,
  p_dedupe_window_seconds integer,
  p_global_window_seconds integer,
  p_global_maximum_requests integer,
  p_token_window_seconds integer,
  p_token_maximum_requests integer,
  p_visitor_window_seconds integer,
  p_visitor_maximum_requests integer
)
RETURNS TABLE(outcome text, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY INVOKER
VOLATILE
PARALLEL UNSAFE
CALLED ON NULL INPUT
SET search_path = ''
AS $$
DECLARE
  v_link public.tracked_link%ROWTYPE;
  v_capacity record;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_bucket timestamptz;
  v_event_id uuid;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'tracked link interaction is restricted to service_role';
  END IF;
  IF p_visitor_hash !~ '^[0-9a-f]{64}$'
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_client_classification NOT IN ('browser', 'preview', 'scanner', 'unknown')
     OR p_dedupe_window_seconds NOT BETWEEN 60 AND 86400
     OR (p_referer_origin IS NOT NULL AND (char_length(p_referer_origin) > 255 OR p_referer_origin !~ '^https?://[^/?#]+$')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tracked link interaction parameters are invalid';
  END IF;
  IF p_client_classification <> 'browser' THEN
    outcome := 'preview'; retry_after_seconds := 0; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_link FROM public.tracked_link
  WHERE id = p_tracked_link_id FOR SHARE;
  IF NOT FOUND THEN outcome := 'expired'; retry_after_seconds := 0; RETURN NEXT; RETURN; END IF;
  IF v_link.revoked_at IS NOT NULL THEN outcome := 'revoked'; retry_after_seconds := 0; RETURN NEXT; RETURN; END IF;
  IF v_link.expires_at IS NULL OR v_link.expires_at <= v_now THEN outcome := 'expired'; retry_after_seconds := 0; RETURN NEXT; RETURN; END IF;
  IF v_link.recipient_user_id IS DISTINCT FROM p_recipient_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'tracked link recipient binding is invalid';
  END IF;

  SELECT * INTO v_capacity FROM public.consume_request_capacity(
    'tracked-link-analytics-global',
    pg_catalog.encode(extensions.digest('tracked-link-analytics-global', 'sha256'), 'hex'),
    p_global_window_seconds,
    p_global_maximum_requests
  );
  IF NOT v_capacity.accepted THEN outcome := 'rate_limited'; retry_after_seconds := v_capacity.retry_after_seconds; RETURN NEXT; RETURN; END IF;
  SELECT * INTO v_capacity FROM public.consume_request_capacity(
    'tracked-link-analytics-token', p_token_hash, p_token_window_seconds, p_token_maximum_requests
  );
  IF NOT v_capacity.accepted THEN outcome := 'rate_limited'; retry_after_seconds := v_capacity.retry_after_seconds; RETURN NEXT; RETURN; END IF;
  SELECT * INTO v_capacity FROM public.consume_request_capacity(
    'tracked-link-analytics-visitor', p_visitor_hash, p_visitor_window_seconds, p_visitor_maximum_requests
  );
  IF NOT v_capacity.accepted THEN outcome := 'rate_limited'; retry_after_seconds := v_capacity.retry_after_seconds; RETURN NEXT; RETURN; END IF;

  v_bucket := pg_catalog.to_timestamp(
    pg_catalog.floor(pg_catalog.date_part('epoch', v_now) / p_dedupe_window_seconds) * p_dedupe_window_seconds
  );
  INSERT INTO public.tracked_link_event(
    tracked_link_id, organization_id, recipient_user_id, event_type,
    visitor_hash, client_classification, referer_origin,
    dedupe_window_started_at, created_at
  ) VALUES (
    v_link.id, v_link.org_id, v_link.recipient_user_id, 'click',
    p_visitor_hash, 'browser', p_referer_origin, v_bucket, v_now
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;
  outcome := CASE WHEN v_event_id IS NULL THEN 'duplicate' ELSE 'recorded' END;
  retry_after_seconds := 0;
  RETURN NEXT;
END
$$;

CREATE OR REPLACE FUNCTION public.cleanup_public_abuse_data(
  p_batch_size integer,
  p_event_retention_days integer,
  p_expired_link_grace_days integer
)
RETURNS TABLE(
  capacity_buckets_deleted integer,
  contact_dedupe_deleted integer,
  events_deleted integer,
  links_deleted integer
)
LANGUAGE plpgsql
SECURITY INVOKER
VOLATILE
PARALLEL UNSAFE
CALLED ON NULL INPUT
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'public abuse cleanup is restricted to service_role';
  END IF;
  IF p_batch_size NOT BETWEEN 1 AND 1000
     OR p_event_retention_days NOT BETWEEN 1 AND 3650
     OR p_expired_link_grace_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'public abuse cleanup parameters are invalid';
  END IF;

  WITH doomed AS (
    SELECT ctid FROM public.request_capacity_bucket
    WHERE expires_at < v_now
    ORDER BY expires_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.request_capacity_bucket WHERE ctid IN (SELECT ctid FROM doomed) RETURNING 1
  ) SELECT count(*)::integer INTO capacity_buckets_deleted FROM deleted;

  WITH doomed AS (
    SELECT ctid FROM public.contact_submission_dedupe
    WHERE expires_at < v_now
    ORDER BY expires_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.contact_submission_dedupe WHERE ctid IN (SELECT ctid FROM doomed) RETURNING 1
  ) SELECT count(*)::integer INTO contact_dedupe_deleted FROM deleted;

  WITH doomed AS (
    SELECT ctid FROM public.tracked_link_event
    WHERE created_at < v_now - pg_catalog.make_interval(days => p_event_retention_days)
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.tracked_link_event WHERE ctid IN (SELECT ctid FROM doomed) RETURNING 1
  ) SELECT count(*)::integer INTO events_deleted FROM deleted;

  WITH doomed AS (
    SELECT ctid FROM public.tracked_link
    WHERE (
      (expires_at IS NOT NULL AND expires_at < v_now - pg_catalog.make_interval(days => p_expired_link_grace_days))
       OR (revoked_at IS NOT NULL AND revoked_at < v_now - pg_catalog.make_interval(days => p_expired_link_grace_days))
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.tracked_link_event AS event
        WHERE event.tracked_link_id = tracked_link.id
    )
    ORDER BY coalesce(revoked_at, expires_at)
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.tracked_link WHERE ctid IN (SELECT ctid FROM doomed) RETURNING 1
  ) SELECT count(*)::integer INTO links_deleted FROM deleted;
  RETURN NEXT;
END
$$;

ALTER TABLE public.request_capacity_bucket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submission_dedupe ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.request_capacity_bucket FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.contact_submission_dedupe FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tracked_link FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tracked_link_event FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.contact FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.request_capacity_bucket TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_submission_dedupe TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tracked_link TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tracked_link_event TO service_role;
GRANT SELECT, INSERT ON TABLE public.contact TO service_role;
REVOKE ALL ON SEQUENCE public.contact_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE public.contact_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.consume_request_capacity(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_deduplicated_contact(text, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_tracked_link_interaction(uuid, text, text, bigint, text, text, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_public_abuse_data(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_capacity(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_deduplicated_contact(text, text, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_tracked_link_interaction(uuid, text, text, bigint, text, text, integer, integer, integer, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_public_abuse_data(integer, integer, integer) TO service_role;

DO $$
DECLARE
  v_failures integer;
BEGIN
  SELECT count(*) INTO v_failures
  FROM (VALUES
    (has_table_privilege('anon', 'public.request_capacity_bucket', 'SELECT')),
    (has_table_privilege('authenticated', 'public.request_capacity_bucket', 'INSERT')),
    (has_table_privilege('anon', 'public.contact_submission_dedupe', 'SELECT')),
    (has_table_privilege('authenticated', 'public.tracked_link_event', 'INSERT')),
    (has_function_privilege('anon', 'public.consume_request_capacity(text,text,integer,integer)', 'EXECUTE')),
    (has_function_privilege('authenticated', 'public.create_deduplicated_contact(text,text,text,text,text,integer)', 'EXECUTE')),
    (NOT has_function_privilege('service_role', 'public.consume_request_capacity(text,text,integer,integer)', 'EXECUTE')),
    (NOT has_function_privilege('service_role', 'public.record_tracked_link_interaction(uuid,text,text,bigint,text,text,integer,integer,integer,integer,integer,integer,integer)', 'EXECUTE')),
    (has_sequence_privilege('anon', 'public.contact_id_seq', 'USAGE')),
    (has_sequence_privilege('authenticated', 'public.contact_id_seq', 'USAGE')),
    (NOT has_sequence_privilege('service_role', 'public.contact_id_seq', 'USAGE'))
  ) AS checks(failed)
  WHERE failed;
  IF v_failures > 0 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = format('Public request controls ACL validation failed: %s check(s)', v_failures);
  END IF;
END
$$;

COMMIT;
