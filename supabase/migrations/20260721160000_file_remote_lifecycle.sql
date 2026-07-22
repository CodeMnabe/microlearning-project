BEGIN;

-- File Migration: Lifecycle, tombstones, compensação e reconciliação

DO $$
DECLARE
  v_oid oid;
  v_contype char;
  v_conkey smallint[];
  v_cols text[];
BEGIN
  -- 1. Ensure composite unique constraint on public.file for FK
  SELECT oid INTO v_oid FROM pg_constraint WHERE conname = 'file_id_organization_id_key' AND conrelid = 'public.file'::regclass;
  IF v_oid IS NULL THEN
    ALTER TABLE public.file ADD CONSTRAINT file_id_organization_id_key UNIQUE (id, organization_id);
  ELSE
    SELECT c.contype, c.conkey INTO v_contype, v_conkey FROM pg_constraint c WHERE c.oid = v_oid;
    IF v_contype != 'u' THEN
      RAISE EXCEPTION 'file_id_organization_id_key already exists but is not UNIQUE';
    END IF;
    SELECT array_agg(a.attname ORDER BY x.n) INTO v_cols
    FROM unnest(v_conkey) WITH ORDINALITY x(attnum, n)
    JOIN pg_attribute a ON a.attrelid = 'public.file'::regclass AND a.attnum = x.attnum;
    IF v_cols IS NULL OR v_cols::text[] != ARRAY['id', 'organization_id']::text[] THEN
      RAISE EXCEPTION 'file_id_organization_id_key exists with wrong columns: %', array_to_string(v_cols, ',');
    END IF;
  END IF;

  -- 2. Create file_remote_operation table
  CREATE TABLE IF NOT EXISTS public.file_remote_operation (
    id serial PRIMARY KEY,
    file_id integer NOT NULL,
    organization_id integer NOT NULL,
    operation_key text NOT NULL,
    provider text NOT NULL,
    action text NOT NULL,
    status text NOT NULL,
    remote_id text,
    remote_bucket text,
    remote_path text,
    remote_outcome text,
    retry_count integer NOT NULL DEFAULT 0,
    next_retry_at timestamp with time zone,
    last_attempt_at timestamp with time zone,
    claimed_at timestamp with time zone,
    claim_expires_at timestamp with time zone,
    last_error_code text,
    last_error_msg text,
    created_at timestamp with time zone NOT NULL DEFAULT pg_catalog.now(),
    updated_at timestamp with time zone NOT NULL DEFAULT pg_catalog.now()
  );

  -- 3. Idempotent composite FK and unique constraints
  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS file_remote_operation_file_id_organization_id_fkey;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT file_remote_operation_file_id_organization_id_fkey
    FOREIGN KEY (file_id, organization_id) REFERENCES public.file (id, organization_id) ON DELETE RESTRICT;

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS file_remote_operation_operation_key_key;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT file_remote_operation_operation_key_key UNIQUE (operation_key);

  -- 4. Add constraints to file_remote_operation idempotently
  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_retry_count;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_retry_count CHECK (retry_count >= 0);

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_error_msg_len;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_error_msg_len CHECK (char_length(last_error_msg) <= 1000);

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_claim_expires;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_claim_expires CHECK (
    (claimed_at IS NULL AND claim_expires_at IS NULL) OR
    (claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL AND claim_expires_at > claimed_at)
  );

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_remote_outcome;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_remote_outcome CHECK (
    remote_outcome IN ('success', 'retryable_failed', 'permanent_failed', 'unknown_outcome') OR remote_outcome IS NULL
  );

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_provider;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_provider CHECK (
    provider IN ('openai', 'storage', 'system')
  );

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_action;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_action CHECK (
    action IN ('create', 'delete', 'update', 'finalize', 'upload')
  );

  ALTER TABLE public.file_remote_operation DROP CONSTRAINT IF EXISTS check_op_status;
  ALTER TABLE public.file_remote_operation ADD CONSTRAINT check_op_status CHECK (
    status IN ('pending', 'in_progress', 'retryable_failed', 'success', 'permanent_failed')
  );

  -- 5. Add new columns to public.file idempotently (remove boolean reconciliation_required)
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS public_bucket text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS public_object_path text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS storage_deleted_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS openai_deleted_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS public_object_deleted_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS last_error_message text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS claim_expires_at timestamp with time zone;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS cleanup_reason text;
  ALTER TABLE public.file DROP COLUMN IF EXISTS reconciliation_required;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS remote_outcome text;
  ALTER TABLE public.file ADD COLUMN IF NOT EXISTS original_status_before_delete text;

  -- 6. Constraints for public.file
  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_file_retry_count;
  ALTER TABLE public.file ADD CONSTRAINT check_file_retry_count CHECK (retry_count >= 0);

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_file_error_msg_len;
  ALTER TABLE public.file ADD CONSTRAINT check_file_error_msg_len CHECK (char_length(last_error_message) <= 1000);

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_file_claim_expires;
  ALTER TABLE public.file ADD CONSTRAINT check_file_claim_expires CHECK (
    (claimed_at IS NULL AND claim_expires_at IS NULL) OR
    (claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL AND claim_expires_at > claimed_at)
  );

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_file_deleted_requires_ts;
  ALTER TABLE public.file ADD CONSTRAINT check_file_deleted_requires_ts CHECK (
    (status = 'deleted' AND deleted_at IS NOT NULL) OR status != 'deleted'
  );

  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_file_remote_outcome;
  ALTER TABLE public.file ADD CONSTRAINT check_file_remote_outcome CHECK (
    remote_outcome IN ('success', 'retryable_failed', 'permanent_failed', 'unknown_outcome') OR remote_outcome IS NULL
  );

  -- 7. Update status constraint to include new states
  ALTER TABLE public.file DROP CONSTRAINT IF EXISTS check_status;
  ALTER TABLE public.file ADD CONSTRAINT check_status
    CHECK (status IN (
      'pending_upload',
      'uploaded',
      'validating',
      'validated',
      'processing',
      'active',
      'rejected',
      'retryable_failed',
      'unknown_outcome',
      'pending_delete',
      'deleting_storage',
      'deleting_openai',
      'delete_retryable_failed',
      'deleted',
      'orphan_candidate',
      'reconciliation_required',
      'failed'
    ));

  -- 8. Indexes
  DROP INDEX IF EXISTS public.idx_file_pending_delete;
  CREATE INDEX idx_file_pending_delete ON public.file (status) WHERE status IN (
    'pending_delete', 'deleting_storage', 'deleting_openai', 'delete_retryable_failed',
    'retryable_failed', 'unknown_outcome', 'orphan_candidate', 'reconciliation_required', 'pending_upload'
  );

  DROP INDEX IF EXISTS public.idx_file_next_retry;
  CREATE INDEX idx_file_next_retry ON public.file (next_retry_at) WHERE next_retry_at IS NOT NULL;

  DROP INDEX IF EXISTS public.idx_file_remote_op_pending;
  CREATE INDEX idx_file_remote_op_pending ON public.file_remote_operation (status) WHERE status IN ('pending', 'in_progress', 'retryable_failed');

END $$;

-- 9. Atomic Claim RPC for file_remote_operation
CREATE OR REPLACE FUNCTION public.claim_file_remote_operations(p_batch_size integer, p_claim_duration interval)
RETURNS TABLE (
  id integer,
  file_id integer,
  organization_id integer,
  operation_key text,
  provider text,
  action text,
  status text,
  remote_id text,
  remote_bucket text,
  remote_path text,
  retry_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 50 THEN
    RAISE EXCEPTION 'p_batch_size must be between 1 and 50';
  END IF;
  IF p_claim_duration IS NULL OR EXTRACT(EPOCH FROM p_claim_duration) < 60 OR EXTRACT(EPOCH FROM p_claim_duration) > 900 THEN
    RAISE EXCEPTION 'p_claim_duration must be between 1 and 15 minutes';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
    FROM public.file_remote_operation o
    WHERE (
        o.status IN ('pending', 'retryable_failed') OR
        (o.status = 'in_progress')
      )
      AND (o.next_retry_at IS NULL OR o.next_retry_at <= now())
      AND (o.claim_expires_at IS NULL OR o.claim_expires_at <= now())
      AND o.retry_count < 10
    ORDER BY o.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.file_remote_operation target
  SET status = 'in_progress',
      claimed_at = now(),
      claim_expires_at = now() + p_claim_duration,
      updated_at = now()
  FROM claimed
  WHERE target.id = claimed.id
  RETURNING target.id, target.file_id, target.organization_id, target.operation_key, target.provider, target.action, target.status, target.remote_id, target.remote_bucket, target.remote_path, target.retry_count;
END;
$$;

-- 10. Atomic Claim RPC for file itself (for abandoned uploads / cleanup)
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
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 50 THEN
    RAISE EXCEPTION 'p_batch_size must be between 1 and 50';
  END IF;
  IF p_claim_duration IS NULL OR EXTRACT(EPOCH FROM p_claim_duration) < 60 OR EXTRACT(EPOCH FROM p_claim_duration) > 900 THEN
    RAISE EXCEPTION 'p_claim_duration must be between 1 and 15 minutes';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT f.id
    FROM public.file f
    WHERE (
        f.status IN ('pending_delete', 'deleting_storage', 'deleting_openai', 'delete_retryable_failed', 'retryable_failed', 'unknown_outcome', 'orphan_candidate', 'reconciliation_required') OR
        (f.status = 'pending_upload' AND f.created_at < now() - interval '24 hours')
      )
      AND (f.next_retry_at IS NULL OR f.next_retry_at <= now())
      AND (f.claim_expires_at IS NULL OR f.claim_expires_at <= now())
      AND f.retry_count < 10
    ORDER BY f.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.file target
  SET claimed_at = now(),
      claim_expires_at = now() + p_claim_duration,
      updated_at = now()
  FROM claimed
  WHERE target.id = claimed.id
  RETURNING target.id, target.status, target.retry_count, target.open_ai_id, target.bucket, target.object_path, target.public_bucket, target.public_object_path, target.organization_id;
END;
$$;

-- 11. Security on table file_remote_operation
ALTER TABLE public.file_remote_operation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.file_remote_operation FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.file_remote_operation TO service_role;

-- 12. Security on sequence
REVOKE ALL ON SEQUENCE public.file_remote_operation_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.file_remote_operation_id_seq TO service_role;

-- 13. Security: Revoke public access to RPCs and grant to service_role
REVOKE ALL ON FUNCTION public.claim_file_remote_operations(integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_file_remote_operations(integer, interval) TO service_role;

REVOKE ALL ON FUNCTION public.claim_files_for_cleanup(integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_files_for_cleanup(integer, interval) TO service_role;

-- 14. Fail-closed validation block
DO $$
DECLARE
  v_rec record;
  v_rec_func record;
  v_oid oid;
  v_contype char;
  v_conkey smallint[];
  v_confkey smallint[];
  v_confrelid oid;
  v_confdeltype char;
  v_cols text[];
  v_cols_ref text[];
  v_constraints_to_check text[] := ARRAY[
    'check_op_retry_count',
    'check_op_error_msg_len',
    'check_op_claim_expires',
    'check_op_remote_outcome',
    'check_op_provider',
    'check_op_action',
    'check_op_status',
    'check_file_retry_count',
    'check_file_error_msg_len',
    'check_file_claim_expires',
    'check_file_deleted_requires_ts',
    'check_file_remote_outcome',
    'check_status'
  ];
  v_expected_conrelid regclass;
  v_c text;
  v_found boolean;
  v_privs text[];
  v_in_argnames text[];
  v_in_argtypes text[];
  v_out_argnames text[];
  v_out_argtypes text[];
BEGIN
  -- Validate file_remote_operation table exists and columns are not null
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'file_remote_operation'
      AND column_name = 'created_at'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'file_remote_operation.created_at missing or nullable';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'file_remote_operation'
      AND column_name = 'updated_at'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'file_remote_operation.updated_at missing or nullable';
  END IF;

  -- Verify RLS is active on file_remote_operation
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.file_remote_operation'::regclass AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'file_remote_operation does not have RLS enabled';
  END IF;

  -- 1. Validate CHECK constraints structurally
  FOREACH v_c IN ARRAY v_constraints_to_check
  LOOP
    IF v_c LIKE 'check_op_%' THEN
      v_expected_conrelid := 'public.file_remote_operation'::regclass;
    ELSE
      v_expected_conrelid := 'public.file'::regclass;
    END IF;

    SELECT oid, convalidated, contype INTO v_oid, v_found, v_contype
    FROM pg_constraint
    WHERE conname = v_c AND conrelid = v_expected_conrelid;

    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Constraint % not found on %', v_c, v_expected_conrelid;
    END IF;

    IF NOT v_found THEN
      RAISE EXCEPTION 'Constraint % is not validated', v_c;
    END IF;

    IF v_contype != 'c' THEN
      RAISE EXCEPTION 'Constraint % is not a CHECK constraint (contype = %)', v_c, v_contype;
    END IF;
  END LOOP;

  -- 2. Validate file_id_organization_id_key structural integrity
  SELECT oid, contype, conkey INTO v_oid, v_contype, v_conkey
  FROM pg_constraint
  WHERE conname = 'file_id_organization_id_key' AND conrelid = 'public.file'::regclass;

  IF v_oid IS NULL THEN RAISE EXCEPTION 'file_id_organization_id_key not found'; END IF;
  IF v_contype != 'u' THEN RAISE EXCEPTION 'file_id_organization_id_key is not UNIQUE'; END IF;

  SELECT array_agg(a.attname ORDER BY x.n) INTO v_cols
  FROM unnest(v_conkey) WITH ORDINALITY x(attnum, n)
  JOIN pg_attribute a ON a.attrelid = 'public.file'::regclass AND a.attnum = x.attnum;

  IF v_cols IS NULL OR v_cols::text[] != ARRAY['id', 'organization_id']::text[] THEN
    RAISE EXCEPTION 'file_id_organization_id_key has wrong columns: %', array_to_string(v_cols, ',');
  END IF;

  -- 3. Validate file_remote_operation_operation_key_key structural integrity
  SELECT oid, contype, conkey INTO v_oid, v_contype, v_conkey
  FROM pg_constraint
  WHERE conname = 'file_remote_operation_operation_key_key' AND conrelid = 'public.file_remote_operation'::regclass;

  IF v_oid IS NULL THEN RAISE EXCEPTION 'file_remote_operation_operation_key_key not found'; END IF;
  IF v_contype != 'u' THEN RAISE EXCEPTION 'file_remote_operation_operation_key_key is not UNIQUE'; END IF;

  SELECT array_agg(a.attname ORDER BY x.n) INTO v_cols
  FROM unnest(v_conkey) WITH ORDINALITY x(attnum, n)
  JOIN pg_attribute a ON a.attrelid = 'public.file_remote_operation'::regclass AND a.attnum = x.attnum;

  IF v_cols IS NULL OR v_cols::text[] != ARRAY['operation_key']::text[] THEN
    RAISE EXCEPTION 'file_remote_operation_operation_key_key has wrong columns: %', array_to_string(v_cols, ',');
  END IF;

  -- 4. Validate file_remote_operation_file_id_organization_id_fkey structural integrity
  SELECT oid, contype, conkey, confkey, confrelid, confdeltype
  INTO v_oid, v_contype, v_conkey, v_confkey, v_confrelid, v_confdeltype
  FROM pg_constraint
  WHERE conname = 'file_remote_operation_file_id_organization_id_fkey' AND conrelid = 'public.file_remote_operation'::regclass;

  IF v_oid IS NULL THEN RAISE EXCEPTION 'file_remote_operation_file_id_organization_id_fkey not found'; END IF;
  IF v_contype != 'f' THEN RAISE EXCEPTION 'file_remote_operation_file_id_organization_id_fkey is not a FOREIGN KEY'; END IF;
  IF v_confrelid != 'public.file'::regclass THEN RAISE EXCEPTION 'FK confrelid mismatch'; END IF;
  IF v_confdeltype NOT IN ('r', 'a') THEN RAISE EXCEPTION 'FK confdeltype is not RESTRICT/NO ACTION (is %)', v_confdeltype; END IF;

  SELECT array_agg(a.attname ORDER BY x.n) INTO v_cols
  FROM unnest(v_conkey) WITH ORDINALITY x(attnum, n)
  JOIN pg_attribute a ON a.attrelid = 'public.file_remote_operation'::regclass AND a.attnum = x.attnum;

  IF v_cols IS NULL OR v_cols::text[] != ARRAY['file_id', 'organization_id']::text[] THEN
    RAISE EXCEPTION 'FK source columns mismatch: %', array_to_string(v_cols, ',');
  END IF;

  SELECT array_agg(a.attname ORDER BY x.n) INTO v_cols_ref
  FROM unnest(v_confkey) WITH ORDINALITY x(attnum, n)
  JOIN pg_attribute a ON a.attrelid = 'public.file'::regclass AND a.attnum = x.attnum;

  IF v_cols_ref IS NULL OR v_cols_ref::text[] != ARRAY['id', 'organization_id']::text[] THEN
    RAISE EXCEPTION 'FK ref columns mismatch: %', array_to_string(v_cols_ref, ',');
  END IF;

  -- Validate table ACLs
  FOR v_rec IN (
    SELECT a.grantee, a.privilege_type,
           CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END as grantee_name
    FROM pg_class c
    JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a ON true
    LEFT JOIN pg_roles r ON r.oid = a.grantee
    WHERE c.oid = 'public.file_remote_operation'::regclass
  )
  LOOP
    IF v_rec.grantee_name IN ('PUBLIC', 'anon', 'authenticated') THEN
      RAISE EXCEPTION 'Table file_remote_operation has insecure grant % to %', v_rec.privilege_type, v_rec.grantee_name;
    END IF;
  END LOOP;

  -- Verify service_role has SELECT, INSERT, UPDATE, DELETE
  v_privs := ARRAY(
    SELECT a.privilege_type
    FROM pg_class c
    JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a ON true
    JOIN pg_roles r ON r.oid = a.grantee
    WHERE c.oid = 'public.file_remote_operation'::regclass
      AND r.rolname = 'service_role'
  );

  IF NOT (v_privs @> ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) THEN
    RAISE EXCEPTION 'Table file_remote_operation missing privileges for service_role. Has: %', array_to_string(v_privs, ',');
  END IF;

  -- Validate sequence ACLs
  FOR v_rec IN (
    SELECT a.grantee, a.privilege_type,
           CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END as grantee_name
    FROM pg_class c
    JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('s', c.relowner))) a ON true
    LEFT JOIN pg_roles r ON r.oid = a.grantee
    WHERE c.oid = 'public.file_remote_operation_id_seq'::regclass
  )
  LOOP
    IF v_rec.grantee_name IN ('PUBLIC', 'anon', 'authenticated') THEN
      RAISE EXCEPTION 'Sequence file_remote_operation_id_seq has insecure grant % to %', v_rec.privilege_type, v_rec.grantee_name;
    END IF;
  END LOOP;

  -- Verify service_role has USAGE, SELECT on sequence
  v_privs := ARRAY(
    SELECT a.privilege_type
    FROM pg_class c
    JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('s', c.relowner))) a ON true
    JOIN pg_roles r ON r.oid = a.grantee
    WHERE c.oid = 'public.file_remote_operation_id_seq'::regclass
      AND r.rolname = 'service_role'
  );

  IF NOT (v_privs @> ARRAY['USAGE', 'SELECT']) THEN
    RAISE EXCEPTION 'Sequence file_remote_operation_id_seq missing privileges for service_role. Has: %', array_to_string(v_privs, ',');
  END IF;

  -- Validate functions ACLs and properties structurally
  FOR v_oid IN
    SELECT to_regprocedure('public.claim_file_remote_operations(integer, interval)')
    UNION ALL
    SELECT to_regprocedure('public.claim_files_for_cleanup(integer, interval)')
  LOOP
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Required function does not exist';
    END IF;

    SELECT p.proname::text, p.prosecdef, p.proconfig, p.proallargtypes, p.proargmodes, p.proargnames
    INTO v_rec_func
    FROM pg_proc p WHERE p.oid = v_oid;

    IF v_rec_func.prosecdef = true THEN
      RAISE EXCEPTION 'Function % is SECURITY DEFINER (must be INVOKER)', v_rec_func.proname;
    END IF;

    IF v_rec_func.proconfig IS NULL OR array_to_string(v_rec_func.proconfig, ',') NOT LIKE '%search_path=pg_catalog, public, pg_temp%' THEN
      RAISE EXCEPTION 'Function % has incorrect search_path: %', v_rec_func.proname, v_rec_func.proconfig;
    END IF;

    -- Validate Inputs ('i' or NULL when no OUT arguments exist, but since we have OUT/TABLE arguments, mode is 'i')
    SELECT array_agg(a.argname ORDER BY a.ord), array_agg(format_type(a.argtype, NULL) ORDER BY a.ord)
    INTO v_in_argnames, v_in_argtypes
    FROM unnest(v_rec_func.proargnames, v_rec_func.proallargtypes, v_rec_func.proargmodes) WITH ORDINALITY a(argname, argtype, argmode, ord)
    WHERE a.argmode = 'i' OR a.argmode IS NULL;

    IF v_in_argtypes::text[] != ARRAY['integer', 'interval']::text[] THEN
      RAISE EXCEPTION 'Function % has wrong input types: %', v_rec_func.proname, array_to_string(v_in_argtypes, ',');
    END IF;

    -- Validate Outputs ('t')
    SELECT array_agg(a.argname ORDER BY a.ord), array_agg(format_type(a.argtype, NULL) ORDER BY a.ord)
    INTO v_out_argnames, v_out_argtypes
    FROM unnest(v_rec_func.proargnames, v_rec_func.proallargtypes, v_rec_func.proargmodes) WITH ORDINALITY a(argname, argtype, argmode, ord)
    WHERE a.argmode = 't';

    IF v_rec_func.proname = 'claim_file_remote_operations' THEN
      IF v_out_argnames::text[] != ARRAY['id','file_id','organization_id','operation_key','provider','action','status','remote_id','remote_bucket','remote_path','retry_count']::text[] THEN
        RAISE EXCEPTION 'Function claim_file_remote_operations wrong output columns: %', array_to_string(v_out_argnames, ',');
      END IF;
      IF v_out_argtypes::text[] != ARRAY['integer','integer','integer','text','text','text','text','text','text','text','integer']::text[] THEN
        RAISE EXCEPTION 'Function claim_file_remote_operations wrong output types: %', array_to_string(v_out_argtypes, ',');
      END IF;
    ELSIF v_rec_func.proname = 'claim_files_for_cleanup' THEN
      IF v_out_argnames::text[] != ARRAY['id','status','retry_count','open_ai_id','bucket','object_path','public_bucket','public_object_path','organization_id']::text[] THEN
        RAISE EXCEPTION 'Function claim_files_for_cleanup wrong output columns: %', array_to_string(v_out_argnames, ',');
      END IF;
      IF v_out_argtypes::text[] != ARRAY['integer','text','integer','text','text','text','text','text','integer']::text[] THEN
        RAISE EXCEPTION 'Function claim_files_for_cleanup wrong output types: %', array_to_string(v_out_argtypes, ',');
      END IF;
    END IF;

    -- Check function grants
    FOR v_rec IN (
      SELECT a.grantee, a.privilege_type,
             CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END as grantee_name
      FROM pg_proc p
      JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
      LEFT JOIN pg_roles r ON r.oid = a.grantee
      WHERE p.oid = v_oid
    )
    LOOP
      IF v_rec.grantee_name IN ('PUBLIC', 'anon', 'authenticated') AND v_rec.privilege_type = 'EXECUTE' THEN
        RAISE EXCEPTION 'Function % has insecure EXECUTE grant to %', v_oid::regprocedure, v_rec.grantee_name;
      END IF;
    END LOOP;

    -- Verify service_role has EXECUTE
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
      JOIN pg_roles r ON r.oid = a.grantee
      WHERE p.oid = v_oid
        AND r.rolname = 'service_role' AND a.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'Function % missing EXECUTE for service_role', v_oid::regprocedure;
    END IF;
  END LOOP;

END $$;

COMMIT;
