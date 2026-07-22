\set ON_ERROR_STOP on
BEGIN;
SET ROLE service_role;
SELECT pg_catalog.set_config('validation.scenario', :'scenario', false);
SELECT pg_catalog.set_config('validation.worker', :'worker', false);

DO $$
DECLARE
  v_scenario text := pg_catalog.current_setting('validation.scenario');
  v_worker text := pg_catalog.current_setting('validation.worker');
  v_outcome text := 'success';
  v_state text;
  v_message text;
  v_constraint text;
  v_reservation_id bigint;
  v_file_ids integer[];
  v_name text;
BEGIN
  BEGIN
    IF v_scenario = 'idempotent_same' THEN
      v_name := 'race-same.png';
      SELECT min(capacity.reservation_id), pg_catalog.array_agg(capacity.id ORDER BY capacity.id)
      INTO v_reservation_id, v_file_ids
      FROM public.reserve_file_capacity(
        1118, NULL, '11180000-0000-4000-8000-000000000001'::uuid, 'broadcast_intent',
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'name', v_name, 'size', 1, 'reserved_bytes', 5242880,
          'bucket', 'quarantine_images',
          'object_path', 'broadcasts/1118/11180000-0000-4000-8000-000000000001-0.png',
          'original_name', v_name, 'safe_extension', 'png', 'mime_type', 'image/png'
        )),
        pg_catalog.now() + interval '1 hour', 0
      ) AS capacity;
    ELSIF v_scenario = 'idempotent_conflict' THEN
      v_name := 'race-conflict-' || v_worker || '.png';
      SELECT min(capacity.reservation_id), pg_catalog.array_agg(capacity.id ORDER BY capacity.id)
      INTO v_reservation_id, v_file_ids
      FROM public.reserve_file_capacity(
        1119, NULL, '11190000-0000-4000-8000-000000000001'::uuid, 'broadcast_intent',
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'name', v_name, 'size', 1, 'reserved_bytes', 5242880,
          'bucket', 'quarantine_images',
          'object_path', 'broadcasts/1119/11190000-0000-4000-8000-000000000001-0.png',
          'original_name', v_name, 'safe_extension', 'png', 'mime_type', 'image/png'
        )),
        pg_catalog.now() + interval '1 hour', 0
      ) AS capacity;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unknown idempotency validation scenario';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
      v_constraint = CONSTRAINT_NAME;
    v_outcome := 'rejected';
  END;

  INSERT INTO validation_fixtures.concurrent_result(
    scenario, worker, outcome, sqlstate, message, constraint_name,
    reservation_id, file_ids
  ) VALUES (
    v_scenario, v_worker, v_outcome, v_state, v_message, v_constraint,
    v_reservation_id, v_file_ids
  );

  IF v_worker = 'a' THEN
    PERFORM pg_catalog.pg_sleep(2);
  END IF;
END;
$$;
COMMIT;
