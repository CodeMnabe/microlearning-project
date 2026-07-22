BEGIN;

-- Storage upload hardening and final schema validation

DO $$
BEGIN

  -- 1. Add Columns to public.file idempotently
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS organization_id integer;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS assistant_id integer;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS bucket text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS object_path text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS original_name text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS safe_extension text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS mime_type text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS size_bytes bigint;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS checksum_sha256 text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS status text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS storage_uploaded_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS validation_completed_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS last_error_code text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS upload_flow text;
  
  -- Prevent failure if created_at/updated_at already exist
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT pg_catalog.now();
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT pg_catalog.now();

  -- 2. Make legacy columns nullable
  ALTER TABLE public.file ALTER COLUMN open_ai_id DROP NOT NULL;
  ALTER TABLE public.file ALTER COLUMN size DROP NOT NULL;

  -- 3. Status and Upload Flow Backfill
  UPDATE public.file SET status = 'active' WHERE status IS NULL;
  ALTER TABLE public.file ALTER COLUMN status SET NOT NULL;
  ALTER TABLE public.file ALTER COLUMN status SET DEFAULT 'pending_upload';

  UPDATE public.file SET upload_flow = 'legacy' WHERE upload_flow IS NULL;
  ALTER TABLE public.file ALTER COLUMN upload_flow DROP DEFAULT;
  ALTER TABLE public.file ALTER COLUMN upload_flow SET NOT NULL;

  -- 4. Constraints
  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_status;
  ALTER TABLE public.file ADD CONSTRAINT check_status 
    CHECK (status IN ('pending_upload', 'uploaded', 'validated', 'rejected', 'processing', 'active', 'failed'));

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_size_bytes;
  ALTER TABLE public.file ADD CONSTRAINT check_size_bytes
    CHECK (size_bytes > 0 OR size_bytes IS NULL);

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_upload_flow_allowlist;
  ALTER TABLE public.file ADD CONSTRAINT check_upload_flow_allowlist
    CHECK (upload_flow IN ('legacy', 'document_intent', 'broadcast_intent'));

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_upload_flow_intent;
  ALTER TABLE public.file ADD CONSTRAINT check_upload_flow_intent
    CHECK (
      upload_flow = 'legacy' OR (
        organization_id IS NOT NULL AND 
        bucket IS NOT NULL AND 
        object_path IS NOT NULL AND 
        original_name IS NOT NULL AND 
        safe_extension IS NOT NULL AND 
        mime_type IS NOT NULL AND 
        size_bytes > 0 AND 
        status IS NOT NULL
      )
    );

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_validated_state;
  ALTER TABLE public.file ADD CONSTRAINT check_validated_state
    CHECK (
      upload_flow = 'legacy' OR
      status NOT IN ('validated', 'processing', 'active') OR 
      (checksum_sha256 IS NOT NULL AND validation_completed_at IS NOT NULL)
    );

  -- 5. Foreign keys
  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS fk_file_organization;
  ALTER TABLE public.file ADD CONSTRAINT fk_file_organization 
    FOREIGN KEY (organization_id) REFERENCES public.organization (id) ON DELETE RESTRICT;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assistant_org' AND conrelid = 'public.assistant'::regclass) THEN
    ALTER TABLE public.assistant ADD CONSTRAINT uq_assistant_org UNIQUE (id, organization_id);
  END IF;

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS fk_file_assistant_tenant_consistent;
  ALTER TABLE public.file ADD CONSTRAINT fk_file_assistant_tenant_consistent
    FOREIGN KEY (assistant_id, organization_id) REFERENCES public.assistant (id, organization_id) ON DELETE RESTRICT;

  -- 6. Indexes and uniqueness
  DROP INDEX IF EXISTS public.uq_bucket_object_path;
  CREATE UNIQUE INDEX uq_bucket_object_path ON public.file (bucket, object_path) WHERE bucket IS NOT NULL AND object_path IS NOT NULL;
  
  DROP INDEX IF EXISTS public.idx_file_org;
  CREATE INDEX idx_file_org ON public.file (organization_id);

  -- 7. Storage Buckets Config
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('quarantine_images', 'quarantine_images', false, 5242880, '{image/jpeg,image/png,image/webp}')
  ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = '{image/jpeg,image/png,image/webp}';

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('documents', 'documents', false, 20971520, '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv}')
  ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv}';

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('images', 'images', true, 5242880, '{image/jpeg,image/png,image/webp}')
  ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = '{image/jpeg,image/png,image/webp}';

END $$;

-- 8. Target Storage Policies Deletion
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "public_read_broadcast_images" ON storage.objects;

-- 9. Final Validation Block
DO $$
DECLARE
  docs_public boolean; docs_limit bigint; docs_mimes text[];
  imgs_public boolean; imgs_limit bigint; imgs_mimes text[];
  quar_public boolean; quar_limit bigint; quar_mimes text[];
  policy_count integer;
  status_not_null text; status_default text;
  flow_not_null text; flow_default text;
  rls_enabled boolean;
  req_constraints text[] := ARRAY['check_status', 'check_size_bytes', 'check_upload_flow_allowlist', 'check_upload_flow_intent', 'check_validated_state', 'fk_file_organization', 'fk_file_assistant_tenant_consistent', 'uq_assistant_org'];
  cname text;
  def text;
BEGIN
  -- 9.1 Column strictness
  SELECT is_nullable::text, column_default INTO status_not_null, status_default 
  FROM information_schema.columns WHERE table_schema='public' AND table_name='file' AND column_name='status';
  
  SELECT is_nullable::text, column_default INTO flow_not_null, flow_default 
  FROM information_schema.columns WHERE table_schema='public' AND table_name='file' AND column_name='upload_flow';
  
  IF status_not_null IS DISTINCT FROM 'NO' OR status_default NOT LIKE '''pending_upload''%' THEN
    RAISE EXCEPTION 'Validation Failed: status column is not properly fail-closed (not null, pending_upload)';
  END IF;
  IF flow_not_null IS DISTINCT FROM 'NO' OR flow_default IS NOT NULL THEN
    RAISE EXCEPTION 'Validation Failed: upload_flow column is not properly strict (not null, no default)';
  END IF;

  -- 9.2 Validate Buckets (Exact Arrays)
  SELECT public, file_size_limit, allowed_mime_types INTO docs_public, docs_limit, docs_mimes FROM storage.buckets WHERE id = 'documents';
  IF NOT FOUND OR docs_public = true OR docs_limit <> 20971520 OR NOT (docs_mimes @> '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv}'::text[] AND '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv}'::text[] @> docs_mimes) THEN
    RAISE EXCEPTION 'Validation Failed: documents bucket misconfigured';
  END IF;

  SELECT public, file_size_limit, allowed_mime_types INTO quar_public, quar_limit, quar_mimes FROM storage.buckets WHERE id = 'quarantine_images';
  IF NOT FOUND OR quar_public = true OR quar_limit <> 5242880 OR NOT (quar_mimes @> '{image/jpeg,image/png,image/webp}'::text[] AND '{image/jpeg,image/png,image/webp}'::text[] @> quar_mimes) THEN
    RAISE EXCEPTION 'Validation Failed: quarantine_images bucket misconfigured';
  END IF;

  SELECT public, file_size_limit, allowed_mime_types INTO imgs_public, imgs_limit, imgs_mimes FROM storage.buckets WHERE id = 'images';
  IF NOT FOUND OR imgs_public = false OR imgs_limit <> 5242880 OR NOT (imgs_mimes @> '{image/jpeg,image/png,image/webp}'::text[] AND '{image/jpeg,image/png,image/webp}'::text[] @> imgs_mimes) THEN
    RAISE EXCEPTION 'Validation Failed: images bucket misconfigured';
  END IF;

  -- 9.3 RLS Enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'objects' AND n.nspname = 'storage';
  IF rls_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Validation Failed: RLS is disabled on storage.objects';
  END IF;

  -- 9.4 Validate Policies (Fail-closed against global or specific target)
  -- Abort on ANY policy INSERT/UPDATE/DELETE/ALL for public/anon/authenticated on storage.objects.
  -- If legitimate policies exist for other buckets, they must be strictly allowlisted by name
  -- and their exact definitions validated.
  SELECT count(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND (roles::text LIKE '%anon%' OR roles::text LIKE '%authenticated%' OR roles::text LIKE '%public%')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND policyname NOT IN (
      -- Explicit allowlist of allowed policies for other buckets.
      -- Must validate their exact expression if any are added here.
      'placeholder_safe_policy'
    );
    
  IF policy_count > 0 THEN
    RAISE EXCEPTION 'Validation Failed: Dangerous RLS policies exist on storage.objects (count: %). Any legitimate policies for other buckets must be explicitly allowlisted.', policy_count;
  END IF;

  -- 9.5 Validate Constraints Definitions Exactly
  SELECT pg_get_constraintdef(c.oid) INTO def 
  FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid 
  WHERE c.conname = 'uq_assistant_org' AND t.relname = 'assistant';
  IF def <> 'UNIQUE (id, organization_id)' THEN
    RAISE EXCEPTION 'Validation Failed: uq_assistant_org is %, expected UNIQUE (id, organization_id)', def;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO def 
  FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid 
  WHERE c.conname = 'fk_file_assistant_tenant_consistent' AND t.relname = 'file';
  IF def NOT LIKE 'FOREIGN KEY (assistant_id, organization_id) REFERENCES assistant(id, organization_id)%' THEN
    RAISE EXCEPTION 'Validation Failed: fk_file_assistant_tenant_consistent is %', def;
  END IF;

  -- 9.6 Validate Indexes Definitions
  SELECT pg_get_indexdef(i.indexrelid) INTO def
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'uq_bucket_object_path' AND n.nspname = 'public';
  IF def NOT LIKE '%UNIQUE INDEX uq_bucket_object_path ON public.file%bucket%object_path%' THEN
    RAISE EXCEPTION 'Validation Failed: uq_bucket_object_path definition is %', def;
  END IF;

  SELECT pg_get_indexdef(i.indexrelid) INTO def
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'idx_file_org' AND n.nspname = 'public';
  IF def NOT LIKE '%INDEX idx_file_org ON public.file%organization_id%' THEN
    RAISE EXCEPTION 'Validation Failed: idx_file_org definition is %', def;
  END IF;

  -- Loop through generic constraint validation
  FOREACH cname IN ARRAY req_constraints
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = cname AND c.convalidated = true AND t.relname IN ('file', 'assistant') AND n.nspname = 'public'
    ) THEN
      RAISE EXCEPTION 'Validation Failed: Constraint % is missing or not validated', cname;
    END IF;
  END LOOP;

END $$;

COMMIT;
