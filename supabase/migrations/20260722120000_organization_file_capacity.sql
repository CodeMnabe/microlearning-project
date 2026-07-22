BEGIN;

ALTER TABLE public.plan ADD COLUMN IF NOT EXISTS max_files integer;
ALTER TABLE public.plan ADD COLUMN IF NOT EXISTS max_storage_bytes bigint;
ALTER TABLE public.plan ADD COLUMN IF NOT EXISTS max_pending_uploads integer;
ALTER TABLE public.plan ADD COLUMN IF NOT EXISTS max_vector_stores integer;

ALTER TABLE public.organization ADD COLUMN IF NOT EXISTS max_files_override integer;
ALTER TABLE public.organization ADD COLUMN IF NOT EXISTS max_storage_bytes_override bigint;
ALTER TABLE public.organization ADD COLUMN IF NOT EXISTS max_pending_uploads_override integer;
ALTER TABLE public.organization ADD COLUMN IF NOT EXISTS max_vector_stores_override integer;

ALTER TABLE public.plan DROP CONSTRAINT IF EXISTS check_plan_file_capacity_limits;
ALTER TABLE public.plan ADD CONSTRAINT check_plan_file_capacity_limits CHECK (
  (max_files IS NULL OR max_files > 0) AND
  (max_storage_bytes IS NULL OR max_storage_bytes > 0) AND
  (max_pending_uploads IS NULL OR max_pending_uploads > 0) AND
  (max_vector_stores IS NULL OR max_vector_stores > 0)
);

ALTER TABLE public.organization DROP CONSTRAINT IF EXISTS check_organization_file_capacity_overrides;
ALTER TABLE public.organization ADD CONSTRAINT check_organization_file_capacity_overrides CHECK (
  (max_files_override IS NULL OR max_files_override > 0) AND
  (max_storage_bytes_override IS NULL OR max_storage_bytes_override > 0) AND
  (max_pending_uploads_override IS NULL OR max_pending_uploads_override > 0) AND
  (max_vector_stores_override IS NULL OR max_vector_stores_override > 0)
);

CREATE TABLE IF NOT EXISTS public.file_capacity_reservation (
  id bigserial PRIMARY KEY,
  organization_id integer NOT NULL,
  assistant_id integer,
  reservation_key uuid NOT NULL,
  upload_flow text NOT NULL,
  requested_file_count integer NOT NULL,
  requested_bytes bigint NOT NULL,
  reserved_bytes bigint NOT NULL,
  requested_vector_store_count integer NOT NULL DEFAULT 0,
  request_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamp with time zone NOT NULL,
  remote_vector_store_id text,
  last_error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamp with time zone NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.file DROP CONSTRAINT IF EXISTS file_capacity_reservation_tenant_fkey;
ALTER TABLE public.vector_store DROP CONSTRAINT IF EXISTS vector_store_capacity_reservation_tenant_fkey;

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS file_capacity_reservation_organization_id_fkey;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT file_capacity_reservation_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organization (id) ON DELETE RESTRICT;

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS file_capacity_reservation_assistant_tenant_fkey;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT file_capacity_reservation_assistant_tenant_fkey
  FOREIGN KEY (assistant_id, organization_id) REFERENCES public.assistant (id, organization_id) ON DELETE RESTRICT;

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS file_capacity_reservation_org_key_key;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT file_capacity_reservation_org_key_key
  UNIQUE (organization_id, reservation_key);

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS file_capacity_reservation_id_org_key;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT file_capacity_reservation_id_org_key
  UNIQUE (id, organization_id);

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS check_file_capacity_reservation_values;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT check_file_capacity_reservation_values CHECK (
  requested_file_count BETWEEN 1 AND 10 AND
  requested_bytes > 0 AND
  reserved_bytes > 0 AND
  requested_vector_store_count BETWEEN 0 AND 1 AND
  jsonb_typeof(request_payload) = 'array' AND
  jsonb_array_length(request_payload) = requested_file_count AND
  expires_at > created_at AND
  char_length(coalesce(last_error_message, '')) <= 1000
);

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS check_file_capacity_reservation_flow;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT check_file_capacity_reservation_flow CHECK (
  (upload_flow = 'document_intent' AND assistant_id IS NOT NULL AND requested_vector_store_count = 1) OR
  (upload_flow = 'broadcast_intent' AND assistant_id IS NULL AND requested_vector_store_count = 0)
);

ALTER TABLE public.file_capacity_reservation DROP CONSTRAINT IF EXISTS check_file_capacity_reservation_status;
ALTER TABLE public.file_capacity_reservation ADD CONSTRAINT check_file_capacity_reservation_status CHECK (
  status IN ('active', 'consumed', 'reconciliation_required', 'released')
);

ALTER TABLE public.file ADD COLUMN IF NOT EXISTS capacity_reservation_id bigint;
ALTER TABLE public.file ADD COLUMN IF NOT EXISTS reserved_bytes bigint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.file
    WHERE upload_flow IN ('document_intent', 'broadcast_intent')
      AND status <> 'deleted'
      AND coalesce(size_bytes, size::bigint) IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing intent files require a known size before file capacity can be enabled';
  END IF;
END;
$$;

INSERT INTO public.file_capacity_reservation (
  organization_id,
  assistant_id,
  reservation_key,
  upload_flow,
  requested_file_count,
  requested_bytes,
  reserved_bytes,
  requested_vector_store_count,
  request_payload,
  status,
  expires_at,
  created_at,
  updated_at
)
SELECT
  f.organization_id,
  f.assistant_id,
  md5('existing-file-capacity-' || f.id::text)::uuid,
  f.upload_flow,
  1,
  coalesce(f.size_bytes, f.size::bigint),
  coalesce(f.size_bytes, f.size::bigint),
  CASE WHEN f.upload_flow = 'document_intent' THEN 1 ELSE 0 END,
  jsonb_build_array(jsonb_build_object(
    'name', f.name,
    'size', coalesce(f.size_bytes, f.size::bigint),
    'reserved_bytes', coalesce(f.size_bytes, f.size::bigint),
    'bucket', f.bucket,
    'object_path', f.object_path,
    'original_name', f.original_name,
    'safe_extension', f.safe_extension,
    'mime_type', f.mime_type
  )),
  CASE WHEN f.status = 'deleted' THEN 'released' ELSE 'active' END,
  greatest(f.created_at + interval '24 hours', pg_catalog.now() + interval '1 minute'),
  f.created_at,
  f.updated_at
FROM public.file AS f
WHERE f.upload_flow IN ('document_intent', 'broadcast_intent')
  AND f.organization_id IS NOT NULL
  AND coalesce(f.size_bytes, f.size::bigint) > 0
ON CONFLICT (organization_id, reservation_key) DO NOTHING;

UPDATE public.file AS f
SET capacity_reservation_id = r.id
FROM public.file_capacity_reservation AS r
WHERE f.capacity_reservation_id IS NULL
  AND r.organization_id = f.organization_id
  AND r.reservation_key = md5('existing-file-capacity-' || f.id::text)::uuid;

UPDATE public.file
SET reserved_bytes = CASE
  WHEN status = 'deleted' THEN 0
  ELSE greatest(coalesce(size_bytes, size::bigint, 0), 0)
END
WHERE reserved_bytes IS NULL;

ALTER TABLE public.file ALTER COLUMN reserved_bytes SET DEFAULT 0;
ALTER TABLE public.file ALTER COLUMN reserved_bytes SET NOT NULL;

ALTER TABLE public.file DROP CONSTRAINT IF EXISTS file_capacity_reservation_tenant_fkey;
ALTER TABLE public.file ADD CONSTRAINT file_capacity_reservation_tenant_fkey
  FOREIGN KEY (capacity_reservation_id, organization_id)
  REFERENCES public.file_capacity_reservation (id, organization_id) ON DELETE RESTRICT;

ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_file_reserved_capacity;
ALTER TABLE public.file ADD CONSTRAINT check_file_reserved_capacity CHECK (
  reserved_bytes >= 0 AND
  (
    upload_flow = 'legacy' OR
    (
      capacity_reservation_id IS NOT NULL AND
      ((status = 'deleted' AND reserved_bytes = 0) OR (status <> 'deleted' AND reserved_bytes > 0))
    )
  )
);

ALTER TABLE public.vector_store ADD COLUMN IF NOT EXISTS organization_id integer;
ALTER TABLE public.vector_store ADD COLUMN IF NOT EXISTS capacity_reservation_id bigint;
ALTER TABLE public.vector_store ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.vector_store ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.vector_store ADD COLUMN IF NOT EXISTS last_error_message text;

UPDATE public.vector_store AS vs
SET organization_id = source.organization_id
FROM (
  SELECT a.vector_store_id, min(a.organization_id) AS organization_id
  FROM public.assistant AS a
  WHERE a.vector_store_id IS NOT NULL
  GROUP BY a.vector_store_id
  HAVING count(DISTINCT a.organization_id) = 1
) AS source
WHERE vs.id = source.vector_store_id
  AND vs.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vector_store WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'Existing vector stores require an unambiguous organization before file capacity can be enabled';
  END IF;
END;
$$;

UPDATE public.vector_store SET status = 'active' WHERE status IS NULL;
ALTER TABLE public.vector_store ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.vector_store ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.vector_store ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.assistant DROP CONSTRAINT IF EXISTS assistant_vector_store_tenant_fkey;

ALTER TABLE public.vector_store DROP CONSTRAINT IF EXISTS vector_store_id_organization_id_key;
ALTER TABLE public.vector_store ADD CONSTRAINT vector_store_id_organization_id_key UNIQUE (id, organization_id);

ALTER TABLE public.assistant ADD CONSTRAINT assistant_vector_store_tenant_fkey
  FOREIGN KEY (vector_store_id, organization_id)
  REFERENCES public.vector_store (id, organization_id) ON DELETE RESTRICT;

ALTER TABLE public.vector_store DROP CONSTRAINT IF EXISTS vector_store_organization_id_fkey;
ALTER TABLE public.vector_store ADD CONSTRAINT vector_store_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organization (id) ON DELETE RESTRICT;

ALTER TABLE public.vector_store DROP CONSTRAINT IF EXISTS vector_store_capacity_reservation_tenant_fkey;
ALTER TABLE public.vector_store ADD CONSTRAINT vector_store_capacity_reservation_tenant_fkey
  FOREIGN KEY (capacity_reservation_id, organization_id)
  REFERENCES public.file_capacity_reservation (id, organization_id) ON DELETE RESTRICT;

ALTER TABLE public.vector_store DROP CONSTRAINT IF EXISTS vector_store_capacity_reservation_id_key;
ALTER TABLE public.vector_store ADD CONSTRAINT vector_store_capacity_reservation_id_key
  UNIQUE (capacity_reservation_id, organization_id);

ALTER TABLE public.vector_store DROP CONSTRAINT IF EXISTS check_vector_store_capacity_status;
ALTER TABLE public.vector_store ADD CONSTRAINT check_vector_store_capacity_status CHECK (
  status IN ('active', 'pending_delete', 'reconciliation_required', 'deleted') AND
  ((status = 'deleted' AND deleted_at IS NOT NULL) OR status <> 'deleted') AND
  char_length(coalesce(last_error_message, '')) <= 1000
);

CREATE INDEX IF NOT EXISTS idx_file_capacity_reservation_active
  ON public.file_capacity_reservation (organization_id, expires_at)
  WHERE status IN ('active', 'reconciliation_required');

CREATE INDEX IF NOT EXISTS idx_file_capacity_reservation_expired
  ON public.file_capacity_reservation (expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_file_capacity_usage
  ON public.file (organization_id, status, reserved_bytes);

CREATE INDEX IF NOT EXISTS idx_vector_store_capacity_usage
  ON public.vector_store (organization_id, status);

CREATE OR REPLACE FUNCTION public.reserve_file_capacity(
  p_organization_id integer,
  p_assistant_id integer,
  p_reservation_key uuid,
  p_upload_flow text,
  p_files jsonb,
  p_expires_at timestamp with time zone,
  p_requested_vector_store_count integer
)
RETURNS TABLE (
  id integer,
  reservation_id bigint,
  reservation_key uuid,
  organization_id integer,
  assistant_id integer,
  bucket text,
  object_path text,
  original_name text,
  safe_extension text,
  mime_type text,
  size_bytes bigint,
  reserved_bytes bigint,
  status text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing public.file_capacity_reservation%ROWTYPE;
  v_reservation public.file_capacity_reservation%ROWTYPE;
  v_file_count integer;
  v_requested_bytes bigint;
  v_reserved_bytes bigint;
  v_max_files integer;
  v_max_storage_bytes bigint;
  v_max_pending_uploads integer;
  v_max_vector_stores integer;
  v_used_files bigint;
  v_used_bytes bigint;
  v_pending_uploads bigint;
  v_used_vector_stores bigint;
  v_reserved_vector_stores bigint;
  v_item jsonb;
  v_max_batch integer;
  v_per_file_reservation bigint;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'reserve_file_capacity is restricted to service_role';
  END IF;

  IF p_organization_id IS NULL OR p_organization_id <= 0 OR p_reservation_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid organization or reservation key';
  END IF;

  IF p_upload_flow = 'document_intent' THEN
    v_max_batch := 10;
    v_per_file_reservation := 20 * 1024 * 1024;
    IF p_assistant_id IS NULL OR p_requested_vector_store_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Document capacity requires an assistant and one vector store slot';
    END IF;
  ELSIF p_upload_flow = 'broadcast_intent' THEN
    v_max_batch := 5;
    v_per_file_reservation := 5 * 1024 * 1024;
    IF p_assistant_id IS NOT NULL OR p_requested_vector_store_count <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Broadcast capacity cannot reserve an assistant or vector store';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported upload flow';
  END IF;

  IF p_files IS NULL OR jsonb_typeof(p_files) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Files must be a JSON array';
  END IF;

  v_file_count := jsonb_array_length(p_files);
  IF v_file_count < 1 OR v_file_count > v_max_batch THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid file count';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at < pg_catalog.now() + interval '5 minutes'
     OR p_expires_at > pg_catalog.now() + interval '24 hours' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Reservation expiration must be between 5 minutes and 24 hours';
  END IF;

  v_requested_bytes := 0;
  v_reserved_bytes := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_files) LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR jsonb_typeof(v_item->'size') <> 'number'
       OR jsonb_typeof(v_item->'reserved_bytes') <> 'number'
       OR (v_item->>'size')::bigint <= 0
       OR (v_item->>'size')::bigint > v_per_file_reservation
       OR (v_item->>'reserved_bytes')::bigint <> v_per_file_reservation
       OR char_length(btrim(coalesce(v_item->>'name', ''))) NOT BETWEEN 1 AND 255
       OR char_length(btrim(coalesce(v_item->>'object_path', ''))) NOT BETWEEN 1 AND 1024
       OR char_length(btrim(coalesce(v_item->>'original_name', ''))) NOT BETWEEN 1 AND 255
       OR char_length(btrim(coalesce(v_item->>'safe_extension', ''))) NOT BETWEEN 1 AND 16
       OR char_length(btrim(coalesce(v_item->>'mime_type', ''))) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid file reservation payload';
    END IF;

    IF (p_upload_flow = 'document_intent' AND v_item->>'bucket' <> 'documents')
       OR (p_upload_flow = 'broadcast_intent' AND v_item->>'bucket' <> 'quarantine_images') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid storage bucket';
    END IF;

    IF (p_upload_flow = 'document_intent' AND (v_item->>'object_path') NOT LIKE
          p_organization_id::text || '/' || p_assistant_id::text || '/' || p_reservation_key::text || '-%')
       OR (p_upload_flow = 'broadcast_intent' AND (v_item->>'object_path') NOT LIKE
          'broadcasts/' || p_organization_id::text || '/' || p_reservation_key::text || '-%') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid server-controlled object path';
    END IF;

    v_requested_bytes := v_requested_bytes + (v_item->>'size')::bigint;
    v_reserved_bytes := v_reserved_bytes + (v_item->>'reserved_bytes')::bigint;
  END LOOP;

  SELECT
    coalesce(o.max_files_override, p.max_files),
    coalesce(o.max_storage_bytes_override, p.max_storage_bytes),
    coalesce(o.max_pending_uploads_override, p.max_pending_uploads),
    coalesce(o.max_vector_stores_override, p.max_vector_stores)
  INTO v_max_files, v_max_storage_bytes, v_max_pending_uploads, v_max_vector_stores
  FROM public.organization AS o
  LEFT JOIN public.plan AS p ON p.id = o.plan_id
  WHERE o.id = p_organization_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Organization not found';
  END IF;

  IF v_max_files IS NULL OR v_max_storage_bytes IS NULL
     OR v_max_pending_uploads IS NULL OR v_max_vector_stores IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FILE_CAPACITY_NOT_CONFIGURED';
  END IF;

  SELECT r.* INTO v_existing
  FROM public.file_capacity_reservation AS r
  WHERE r.organization_id = p_organization_id
    AND r.reservation_key = p_reservation_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.assistant_id IS DISTINCT FROM p_assistant_id
       OR v_existing.upload_flow <> p_upload_flow
       OR v_existing.requested_file_count <> v_file_count
       OR v_existing.requested_bytes <> v_requested_bytes
       OR v_existing.reserved_bytes <> v_reserved_bytes
       OR v_existing.requested_vector_store_count <> p_requested_vector_store_count
       OR v_existing.request_payload <> p_files THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'File capacity reservation key conflicts with another request';
    END IF;

    RETURN QUERY
    SELECT f.id, v_existing.id, v_existing.reservation_key, f.organization_id, f.assistant_id,
           f.bucket, f.object_path, f.original_name, f.safe_extension, f.mime_type,
           f.size_bytes, f.reserved_bytes, f.status
    FROM public.file AS f
    WHERE f.capacity_reservation_id = v_existing.id
      AND f.organization_id = p_organization_id
    ORDER BY f.id;
    RETURN;
  END IF;

  IF p_assistant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.assistant AS a
    WHERE a.id = p_assistant_id AND a.organization_id = p_organization_id
      AND a.vector_store_id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Assistant is unavailable for this organization';
  END IF;

  SELECT count(*), coalesce(sum(f.reserved_bytes), 0),
         count(*) FILTER (WHERE f.status = 'pending_upload')
  INTO v_used_files, v_used_bytes, v_pending_uploads
  FROM public.file AS f
  WHERE f.organization_id = p_organization_id
    AND f.status <> 'deleted';

  SELECT count(*) INTO v_used_vector_stores
  FROM public.vector_store AS vs
  WHERE vs.organization_id = p_organization_id
    AND vs.status <> 'deleted';

  SELECT coalesce(sum(r.requested_vector_store_count), 0) INTO v_reserved_vector_stores
  FROM public.file_capacity_reservation AS r
  WHERE r.organization_id = p_organization_id
    AND r.status IN ('active', 'reconciliation_required')
    AND r.requested_vector_store_count > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.vector_store AS vs
      WHERE vs.capacity_reservation_id = r.id
        AND vs.organization_id = r.organization_id
        AND vs.status <> 'deleted'
    );

  IF v_used_files + v_file_count > v_max_files THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FILE_COUNT_LIMIT_EXCEEDED';
  END IF;
  IF v_used_bytes + v_reserved_bytes > v_max_storage_bytes THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STORAGE_BYTES_LIMIT_EXCEEDED';
  END IF;
  IF v_pending_uploads + v_file_count > v_max_pending_uploads THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PENDING_UPLOAD_LIMIT_EXCEEDED';
  END IF;
  IF v_used_vector_stores + v_reserved_vector_stores + p_requested_vector_store_count > v_max_vector_stores THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VECTOR_STORE_LIMIT_EXCEEDED';
  END IF;

  INSERT INTO public.file_capacity_reservation (
    organization_id, assistant_id, reservation_key, upload_flow,
    requested_file_count, requested_bytes, reserved_bytes,
    requested_vector_store_count, request_payload, expires_at
  ) VALUES (
    p_organization_id, p_assistant_id, p_reservation_key, p_upload_flow,
    v_file_count, v_requested_bytes, v_reserved_bytes,
    p_requested_vector_store_count, p_files, p_expires_at
  ) RETURNING * INTO v_reservation;

  INSERT INTO public.file (
    organization_id, assistant_id, capacity_reservation_id,
    bucket, object_path, original_name, safe_extension, mime_type,
    size_bytes, reserved_bytes, status, upload_flow, name, size
  )
  SELECT
    p_organization_id,
    p_assistant_id,
    v_reservation.id,
    item.value->>'bucket',
    item.value->>'object_path',
    item.value->>'original_name',
    item.value->>'safe_extension',
    item.value->>'mime_type',
    (item.value->>'size')::bigint,
    (item.value->>'reserved_bytes')::bigint,
    'pending_upload',
    p_upload_flow,
    item.value->>'name',
    (item.value->>'size')::integer
  FROM jsonb_array_elements(p_files) WITH ORDINALITY AS item(value, ordinal)
  ORDER BY item.ordinal;

  RETURN QUERY
  SELECT f.id, v_reservation.id, v_reservation.reservation_key, f.organization_id, f.assistant_id,
         f.bucket, f.object_path, f.original_name, f.safe_extension, f.mime_type,
         f.size_bytes, f.reserved_bytes, f.status
  FROM public.file AS f
  WHERE f.capacity_reservation_id = v_reservation.id
    AND f.organization_id = p_organization_id
  ORDER BY f.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_file_reserved_capacity(
  p_organization_id integer,
  p_file_id integer,
  p_actual_bytes bigint
)
RETURNS TABLE (id integer, size_bytes bigint, reserved_bytes bigint, status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_file public.file%ROWTYPE;
  v_limit bigint;
  v_used bigint;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'adjust_file_reserved_capacity is restricted to service_role';
  END IF;
  IF p_organization_id IS NULL OR p_file_id IS NULL OR p_actual_bytes IS NULL OR p_actual_bytes <= 0
     OR p_actual_bytes > 20 * 1024 * 1024 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid actual file size';
  END IF;

  PERFORM 1 FROM public.organization AS o WHERE o.id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Organization not found'; END IF;

  SELECT f.* INTO v_file FROM public.file AS f
  WHERE f.id = p_file_id AND f.organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND OR v_file.status = 'deleted' THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'File not found';
  END IF;

  IF (v_file.upload_flow = 'broadcast_intent' AND p_actual_bytes > 5 * 1024 * 1024)
     OR (v_file.upload_flow = 'document_intent' AND p_actual_bytes > 20 * 1024 * 1024) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Actual file size exceeds flow limit';
  END IF;

  SELECT coalesce(o.max_storage_bytes_override, p.max_storage_bytes)
  INTO v_limit
  FROM public.organization AS o
  LEFT JOIN public.plan AS p ON p.id = o.plan_id
  WHERE o.id = p_organization_id;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FILE_CAPACITY_NOT_CONFIGURED';
  END IF;

  SELECT coalesce(sum(f.reserved_bytes), 0) INTO v_used
  FROM public.file AS f
  WHERE f.organization_id = p_organization_id AND f.status <> 'deleted';

  IF v_used - v_file.reserved_bytes + p_actual_bytes > v_limit THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STORAGE_BYTES_LIMIT_EXCEEDED';
  END IF;

  RETURN QUERY
  UPDATE public.file AS f
  SET size_bytes = p_actual_bytes,
      reserved_bytes = p_actual_bytes,
      updated_at = pg_catalog.now()
  WHERE f.id = p_file_id AND f.organization_id = p_organization_id
  RETURNING f.id, f.size_bytes, f.reserved_bytes, f.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_vector_store_capacity(
  p_organization_id integer,
  p_assistant_id integer,
  p_reservation_key uuid,
  p_store_name text,
  p_remote_id text
)
RETURNS TABLE (id integer, store_name text, open_ai_id text, status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_reservation public.file_capacity_reservation%ROWTYPE;
  v_existing public.vector_store%ROWTYPE;
  v_store public.vector_store%ROWTYPE;
  v_max_vector_stores integer;
  v_used_vector_stores bigint;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'materialize_vector_store_capacity is restricted to service_role';
  END IF;
  IF p_organization_id IS NULL OR p_assistant_id IS NULL OR p_reservation_key IS NULL
     OR char_length(btrim(coalesce(p_store_name, ''))) NOT BETWEEN 1 AND 200
     OR char_length(btrim(coalesce(p_remote_id, ''))) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid vector store materialization request';
  END IF;

  SELECT coalesce(o.max_vector_stores_override, p.max_vector_stores)
  INTO v_max_vector_stores
  FROM public.organization AS o
  LEFT JOIN public.plan AS p ON p.id = o.plan_id
  WHERE o.id = p_organization_id
  FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Organization not found'; END IF;
  IF v_max_vector_stores IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FILE_CAPACITY_NOT_CONFIGURED';
  END IF;

  SELECT r.* INTO v_reservation
  FROM public.file_capacity_reservation AS r
  WHERE r.organization_id = p_organization_id AND r.reservation_key = p_reservation_key
  FOR UPDATE;
  IF NOT FOUND OR v_reservation.assistant_id <> p_assistant_id
     OR v_reservation.upload_flow <> 'document_intent'
     OR v_reservation.requested_vector_store_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Vector store reservation not found';
  END IF;

  SELECT vs.* INTO v_existing
  FROM public.vector_store AS vs
  WHERE vs.capacity_reservation_id = v_reservation.id
    AND vs.organization_id = p_organization_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.open_ai_id IS DISTINCT FROM p_remote_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Reservation already materialized with another remote vector store';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.store_name, v_existing.open_ai_id, v_existing.status;
    RETURN;
  END IF;

  IF v_reservation.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Reservation cannot be materialized in its current state';
  END IF;

  SELECT count(*) INTO v_used_vector_stores
  FROM public.vector_store AS vs
  WHERE vs.organization_id = p_organization_id
    AND vs.status <> 'deleted';
  IF v_used_vector_stores >= v_max_vector_stores THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'VECTOR_STORE_LIMIT_EXCEEDED';
  END IF;

  PERFORM 1 FROM public.assistant AS a
  WHERE a.id = p_assistant_id AND a.organization_id = p_organization_id
    AND a.vector_store_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Assistant already has a vector store or belongs to another organization';
  END IF;

  INSERT INTO public.vector_store (
    store_name, open_ai_id, organization_id, capacity_reservation_id, status
  ) VALUES (
    btrim(p_store_name), p_remote_id, p_organization_id, v_reservation.id, 'active'
  ) RETURNING * INTO v_store;

  UPDATE public.file AS f
  SET vector_store_id = v_store.id,
      status = 'active',
      updated_at = pg_catalog.now()
  WHERE f.capacity_reservation_id = v_reservation.id
    AND f.organization_id = p_organization_id
    AND f.status = 'validated';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Reservation has no validated files';
  END IF;

  UPDATE public.assistant AS a
  SET vector_store_id = v_store.id
  WHERE a.id = p_assistant_id AND a.organization_id = p_organization_id;

  UPDATE public.file_capacity_reservation AS r
  SET status = 'consumed', remote_vector_store_id = p_remote_id, updated_at = pg_catalog.now()
  WHERE r.id = v_reservation.id AND r.organization_id = p_organization_id;

  RETURN QUERY SELECT v_store.id, v_store.store_name, v_store.open_ai_id, v_store.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_file_capacity_reconciliation_required(
  p_organization_id integer,
  p_reservation_key uuid,
  p_remote_vector_store_id text,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'mark_file_capacity_reconciliation_required is restricted to service_role';
  END IF;
  IF p_organization_id IS NULL OR p_reservation_key IS NULL
     OR char_length(btrim(coalesce(p_remote_vector_store_id, ''))) NOT BETWEEN 1 AND 255
     OR char_length(coalesce(p_error_message, '')) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid reconciliation request';
  END IF;

  UPDATE public.file_capacity_reservation
  SET status = 'reconciliation_required',
      remote_vector_store_id = btrim(p_remote_vector_store_id),
      last_error_message = p_error_message,
      updated_at = pg_catalog.now()
  WHERE organization_id = p_organization_id
    AND reservation_key = p_reservation_key
    AND status IN ('active', 'reconciliation_required')
    AND (
      status = 'active'
      OR remote_vector_store_id = btrim(p_remote_vector_store_id)
    );

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.file_capacity_reservation AS r
      WHERE r.organization_id = p_organization_id AND r.reservation_key = p_reservation_key
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Reservation cannot require reconciliation in its current state';
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Reservation not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_file_capacity_reconciliation(
  p_organization_id integer,
  p_reservation_key uuid,
  p_remote_vector_store_id text,
  p_remote_cleanup_confirmed boolean
)
RETURNS TABLE (id bigint, status text, reserved_bytes bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_reservation public.file_capacity_reservation%ROWTYPE;
  v_remote_vector_store_id text;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'complete_file_capacity_reconciliation is restricted to service_role';
  END IF;

  v_remote_vector_store_id := btrim(coalesce(p_remote_vector_store_id, ''));
  IF p_organization_id IS NULL OR p_reservation_key IS NULL
     OR char_length(v_remote_vector_store_id) NOT BETWEEN 1 AND 255
     OR p_remote_cleanup_confirmed IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid reconciliation completion request';
  END IF;
  IF NOT p_remote_cleanup_confirmed THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Remote cleanup is not confirmed';
  END IF;

  PERFORM 1 FROM public.organization AS o WHERE o.id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Organization not found'; END IF;

  SELECT r.* INTO v_reservation
  FROM public.file_capacity_reservation AS r
  WHERE r.organization_id = p_organization_id AND r.reservation_key = p_reservation_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Reservation not found'; END IF;

  IF v_reservation.remote_vector_store_id IS NULL
     OR btrim(v_reservation.remote_vector_store_id) = ''
     OR btrim(v_reservation.remote_vector_store_id) <> v_remote_vector_store_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Remote vector store id does not match reservation';
  END IF;

  IF v_reservation.status = 'released' THEN
    RETURN QUERY SELECT v_reservation.id, v_reservation.status, v_reservation.reserved_bytes;
    RETURN;
  END IF;
  IF v_reservation.status <> 'reconciliation_required' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Reservation does not require reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vector_store AS vs
    WHERE vs.capacity_reservation_id = v_reservation.id
      AND vs.organization_id = p_organization_id
      AND vs.status <> 'deleted'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Local vector store cleanup is incomplete';
  END IF;

  UPDATE public.file AS f
  SET status = 'deleted',
      reserved_bytes = 0,
      storage_deleted_at = CASE
        WHEN f.object_path IS NOT NULL AND f.bucket IS NOT NULL THEN coalesce(f.storage_deleted_at, pg_catalog.now())
        ELSE f.storage_deleted_at
      END,
      public_object_deleted_at = CASE
        WHEN f.public_object_path IS NOT NULL AND f.public_bucket IS NOT NULL THEN coalesce(f.public_object_deleted_at, pg_catalog.now())
        ELSE f.public_object_deleted_at
      END,
      openai_deleted_at = CASE
        WHEN f.open_ai_id IS NOT NULL THEN coalesce(f.openai_deleted_at, pg_catalog.now())
        ELSE f.openai_deleted_at
      END,
      deleted_at = coalesce(f.deleted_at, pg_catalog.now()),
      claimed_at = NULL,
      claim_expires_at = NULL,
      updated_at = pg_catalog.now()
  WHERE f.capacity_reservation_id = v_reservation.id
    AND f.organization_id = p_organization_id
    AND f.status <> 'deleted';

  UPDATE public.file_capacity_reservation AS r
  SET status = 'released',
      last_error_message = NULL,
      updated_at = pg_catalog.now()
  WHERE r.id = v_reservation.id AND r.organization_id = p_organization_id;

  v_reservation.status := 'released';

  RETURN QUERY SELECT v_reservation.id, v_reservation.status, v_reservation.reserved_bytes;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_file_cleanup(
  p_organization_id integer,
  p_file_id integer,
  p_storage_deleted boolean,
  p_public_object_deleted boolean,
  p_openai_deleted boolean
)
RETURNS TABLE (id integer, status text, reserved_bytes bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_file public.file%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'complete_file_cleanup is restricted to service_role';
  END IF;
  IF p_organization_id IS NULL OR p_file_id IS NULL
     OR p_storage_deleted IS NULL OR p_public_object_deleted IS NULL OR p_openai_deleted IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid cleanup completion request';
  END IF;

  PERFORM 1 FROM public.organization AS o WHERE o.id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Organization not found'; END IF;

  SELECT f.* INTO v_file FROM public.file AS f
  WHERE f.id = p_file_id AND f.organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'File not found'; END IF;

  IF (v_file.object_path IS NOT NULL AND v_file.bucket IS NOT NULL AND NOT p_storage_deleted)
     OR (v_file.public_object_path IS NOT NULL AND v_file.public_bucket IS NOT NULL AND NOT p_public_object_deleted)
     OR (v_file.open_ai_id IS NOT NULL AND NOT p_openai_deleted) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Remote cleanup is incomplete';
  END IF;

  RETURN QUERY
  UPDATE public.file AS f
  SET status = 'deleted',
      reserved_bytes = 0,
      storage_deleted_at = CASE WHEN v_file.object_path IS NOT NULL THEN pg_catalog.now() ELSE f.storage_deleted_at END,
      public_object_deleted_at = CASE WHEN v_file.public_object_path IS NOT NULL THEN pg_catalog.now() ELSE f.public_object_deleted_at END,
      openai_deleted_at = CASE WHEN v_file.open_ai_id IS NOT NULL THEN pg_catalog.now() ELSE f.openai_deleted_at END,
      deleted_at = pg_catalog.now(),
      claimed_at = NULL,
      claim_expires_at = NULL,
      updated_at = pg_catalog.now()
  WHERE f.id = p_file_id AND f.organization_id = p_organization_id
  RETURNING f.id, f.status, f.reserved_bytes;

  UPDATE public.file_capacity_reservation AS r
  SET status = 'released', updated_at = pg_catalog.now()
  WHERE r.id = v_file.capacity_reservation_id
    AND r.organization_id = p_organization_id
    AND r.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.file AS remaining
      WHERE remaining.capacity_reservation_id = r.id
        AND remaining.organization_id = r.organization_id
        AND remaining.status <> 'deleted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.vector_store AS vs
      WHERE vs.capacity_reservation_id = r.id
        AND vs.organization_id = r.organization_id
        AND vs.status <> 'deleted'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_files_for_cleanup(p_batch_size integer, p_claim_duration interval)
RETURNS TABLE (
  id integer,
  status text,
  retry_count integer,
  open_ai_id text,
  bucket text,
  object_path text,
  public_bucket text,
  public_object_path text,
  organization_id integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'claim_files_for_cleanup is restricted to service_role';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'p_batch_size must be between 1 and 100';
  END IF;
  IF p_claim_duration IS NULL OR extract(epoch FROM p_claim_duration) < 60
     OR extract(epoch FROM p_claim_duration) > 900 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'p_claim_duration must be between 1 and 15 minutes';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT f.id
    FROM public.file AS f
    LEFT JOIN public.file_capacity_reservation AS r
      ON r.id = f.capacity_reservation_id AND r.organization_id = f.organization_id
    WHERE (
      f.status IN (
        'pending_delete', 'deleting_storage', 'deleting_openai', 'delete_retryable_failed',
        'retryable_failed', 'unknown_outcome', 'orphan_candidate', 'reconciliation_required', 'rejected'
      )
      OR (f.status = 'pending_upload' AND coalesce(r.expires_at, f.created_at + interval '24 hours') <= pg_catalog.now())
      OR (f.status IN ('validating', 'processing') AND f.updated_at < pg_catalog.now() - interval '30 minutes')
    )
      AND (f.next_retry_at IS NULL OR f.next_retry_at <= pg_catalog.now())
      AND (f.claim_expires_at IS NULL OR f.claim_expires_at <= pg_catalog.now())
    ORDER BY f.created_at, f.id
    FOR UPDATE OF f SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.file AS target
  SET claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + p_claim_duration,
      last_attempt_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  FROM claimed
  WHERE target.id = claimed.id
  RETURNING target.id, target.status, target.retry_count, target.open_ai_id,
            target.bucket, target.object_path, target.public_bucket,
            target.public_object_path, target.organization_id;
END;
$$;

ALTER TABLE public.file_capacity_reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_store ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.file_capacity_reservation FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON TABLE public.file_capacity_reservation FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.file_capacity_reservation TO service_role;

REVOKE ALL ON SEQUENCE public.file_capacity_reservation_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.file_capacity_reservation_id_seq FROM service_role;
GRANT USAGE, SELECT ON SEQUENCE public.file_capacity_reservation_id_seq TO service_role;

REVOKE ALL ON TABLE public.file, public.vector_store FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.file, public.vector_store FROM service_role;

GRANT SELECT ON TABLE public.plan TO service_role;
GRANT SELECT, UPDATE ON TABLE public.organization, public.assistant TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.file, public.vector_store TO service_role;

REVOKE ALL ON SEQUENCE public.file_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.vector_store_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.file_id_seq FROM service_role;
REVOKE ALL ON SEQUENCE public.vector_store_id_seq FROM service_role;
GRANT USAGE, SELECT ON SEQUENCE public.file_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.vector_store_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.reserve_file_capacity(integer, integer, uuid, text, jsonb, timestamp with time zone, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_file_reserved_capacity(integer, integer, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.materialize_vector_store_capacity(integer, integer, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_file_capacity_reconciliation_required(integer, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_file_capacity_reconciliation(integer, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_file_cleanup(integer, integer, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_files_for_cleanup(integer, interval) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_file_capacity(integer, integer, uuid, text, jsonb, timestamp with time zone, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_file_reserved_capacity(integer, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.materialize_vector_store_capacity(integer, integer, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_file_capacity_reconciliation_required(integer, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_file_capacity_reconciliation(integer, uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_file_cleanup(integer, integer, boolean, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_files_for_cleanup(integer, interval) TO service_role;

DO $$
DECLARE
  v_function regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'public.file_capacity_reservation'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'file_capacity_reservation must have RLS enabled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('file_capacity_reservation', 'file', 'vector_store')
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Untrusted roles retain file capacity mutation privileges';
  END IF;

  FOREACH v_function IN ARRAY ARRAY[
    'public.reserve_file_capacity(integer,integer,uuid,text,jsonb,timestamp with time zone,integer)'::regprocedure,
    'public.adjust_file_reserved_capacity(integer,integer,bigint)'::regprocedure,
    'public.materialize_vector_store_capacity(integer,integer,uuid,text,text)'::regprocedure,
    'public.mark_file_capacity_reconciliation_required(integer,uuid,text,text)'::regprocedure,
    'public.complete_file_capacity_reconciliation(integer,uuid,text,boolean)'::regprocedure,
    'public.complete_file_cleanup(integer,integer,boolean,boolean,boolean)'::regprocedure,
    'public.claim_files_for_cleanup(integer,interval)'::regprocedure
  ] LOOP
    IF (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid = v_function) THEN
      RAISE EXCEPTION 'Function % must be SECURITY INVOKER', v_function;
    END IF;
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'Untrusted role can execute %', v_function;
    END IF;
    IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role cannot execute %', v_function;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
