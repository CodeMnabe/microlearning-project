\set ON_ERROR_STOP on

-- Same key and same payload: both sessions return the single reservation and
-- the exact same file IDs.
DO $$
DECLARE v_first record; v_second record;
BEGIN
  SELECT * INTO v_first FROM validation_fixtures.concurrent_result
  WHERE scenario = 'idempotent_same' AND worker = 'a';
  SELECT * INTO v_second FROM validation_fixtures.concurrent_result
  WHERE scenario = 'idempotent_same' AND worker = 'b';

  IF v_first.outcome <> 'success' OR v_second.outcome <> 'success'
     OR v_first.sqlstate IS NOT NULL OR v_second.sqlstate IS NOT NULL
     OR v_first.message IS NOT NULL OR v_second.message IS NOT NULL
     OR coalesce(v_first.constraint_name, '') <> ''
     OR coalesce(v_second.constraint_name, '') <> '' THEN
    RAISE EXCEPTION 'identical idempotency race did not produce two clean successes: first=% second=%',
      pg_catalog.row_to_json(v_first), pg_catalog.row_to_json(v_second);
  END IF;
  IF v_first.reservation_id IS NULL
     OR v_first.reservation_id IS DISTINCT FROM v_second.reservation_id
     OR v_first.file_ids IS DISTINCT FROM v_second.file_ids THEN
    RAISE EXCEPTION 'identical idempotency race returned different rows: first=% second=%',
      pg_catalog.row_to_json(v_first), pg_catalog.row_to_json(v_second);
  END IF;
  IF (SELECT count(*) FROM public.file_capacity_reservation
      WHERE organization_id = 1118
        AND reservation_key = '11180000-0000-4000-8000-000000000001'::uuid) <> 1
     OR (SELECT count(*) FROM public.file
         WHERE organization_id = 1118 AND capacity_reservation_id = v_first.reservation_id) <> 1
     OR pg_catalog.cardinality(v_first.file_ids) <> 1 THEN
    RAISE EXCEPTION 'identical idempotency race duplicated a reservation or file';
  END IF;
END;
$$;

-- Same key and different payload: one complete winner and one exact 23505,
-- without partial rows from the rejected request.
DO $$
DECLARE v_success record; v_rejected record; v_rejected_name text;
BEGIN
  SELECT * INTO v_success FROM validation_fixtures.concurrent_result
  WHERE scenario = 'idempotent_conflict' AND outcome = 'success';
  SELECT * INTO v_rejected FROM validation_fixtures.concurrent_result
  WHERE scenario = 'idempotent_conflict' AND outcome = 'rejected';

  IF (SELECT count(*) FROM validation_fixtures.concurrent_result
      WHERE scenario = 'idempotent_conflict' AND outcome = 'success') <> 1
     OR (SELECT count(*) FROM validation_fixtures.concurrent_result
         WHERE scenario = 'idempotent_conflict' AND outcome = 'rejected') <> 1 THEN
    RAISE EXCEPTION 'incompatible idempotency race expected one success and one rejection';
  END IF;
  IF v_rejected.sqlstate <> '23505'
     OR v_rejected.message <> 'File capacity reservation key conflicts with another request'
     OR coalesce(v_rejected.constraint_name, '') <> '' THEN
    RAISE EXCEPTION 'incompatible idempotency race wrong error: state=% message=% constraint=%',
      v_rejected.sqlstate, v_rejected.message, v_rejected.constraint_name;
  END IF;
  IF v_success.reservation_id IS NULL OR pg_catalog.cardinality(v_success.file_ids) <> 1
     OR v_rejected.reservation_id IS NOT NULL OR v_rejected.file_ids IS NOT NULL
     OR (SELECT count(*) FROM public.file_capacity_reservation
         WHERE organization_id = 1119
           AND reservation_key = '11190000-0000-4000-8000-000000000001'::uuid) <> 1
     OR (SELECT count(*) FROM public.file
         WHERE organization_id = 1119 AND capacity_reservation_id = v_success.reservation_id) <> 1 THEN
    RAISE EXCEPTION 'incompatible idempotency race left duplicate or partial rows';
  END IF;

  v_rejected_name := 'race-conflict-' || v_rejected.worker || '.png';
  IF EXISTS (
    SELECT 1 FROM public.file
    WHERE organization_id = 1119
      AND (name = v_rejected_name OR original_name = v_rejected_name)
  ) THEN
    RAISE EXCEPTION 'incompatible idempotency race persisted the rejected payload';
  END IF;
END;
$$;
