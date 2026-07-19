-- 1. Create the migrations directory and migration file (Done via filesystem)

-- 2. Define tally_form_configs table
CREATE TABLE public.tally_form_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type text NOT NULL UNIQUE CHECK (context_type IN ('member', 'visitor', 'child')),
    tally_form_id text NOT NULL,
    tally_form_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- 3. Define tally_submissions table
CREATE TABLE public.tally_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type text NOT NULL CHECK (context_type IN ('member', 'visitor', 'child')),
    tally_form_id text NOT NULL,
    tally_response_id text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'imported', 'needs_review', 'resolved_existing')),
    raw_payload jsonb NOT NULL,
    mapped_data jsonb,
    mapping_errors jsonb,
    duplicate_delivery_count integer NOT NULL DEFAULT 0,
    last_duplicate_received_at timestamptz,
    candidate_matches jsonb,
    resolution_type text CHECK (resolution_type IN ('import_as_new', 'mark_as_existing')),
    resolution_reason text,
    resolved_existing_record_id uuid,
    resolved_by uuid REFERENCES auth.users(id),
    resolved_at timestamptz,
    imported_record_id uuid,
    imported_by uuid REFERENCES auth.users(id),
    imported_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_notes text,
    submitted_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Add indexes
CREATE UNIQUE INDEX ON tally_submissions (tally_response_id);
CREATE INDEX ON tally_submissions (context_type, status);
CREATE INDEX ON tally_submissions (status);
CREATE INDEX ON tally_submissions (last_duplicate_received_at);

-- 5. Define rpc_import_tally_submission Postgres function
CREATE OR REPLACE FUNCTION public.rpc_import_tally_submission(
    p_submission_id uuid,
    p_mapped_data jsonb,
    p_context_type text,
    p_imported_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_imported_record_id uuid;
    v_sql text;
    v_target_table text;
    v_keys text;
BEGIN
    IF p_context_type = 'member' THEN
        v_target_table := 'members';
    ELSIF p_context_type = 'visitor' THEN
        v_target_table := 'visitors';
    ELSIF p_context_type = 'child' THEN
        v_target_table := 'children_members';
    ELSE
        RAISE EXCEPTION 'Invalid context_type: %', p_context_type;
    END IF;

    -- Ensure 'created_by' is explicitly mapped to p_imported_by if not included
    IF NOT p_mapped_data ? 'created_by' THEN
        p_mapped_data := jsonb_set(p_mapped_data, '{created_by}', to_jsonb(p_imported_by));
    END IF;

    -- Extract keys from the JSON object to form the column list
    -- We only insert columns that are present in the mapped_data, allowing table defaults to trigger
    SELECT string_agg(quote_ident(key), ', ')
    INTO v_keys
    FROM jsonb_object_keys(p_mapped_data) AS x(key);

    IF v_keys IS NULL OR v_keys = '' THEN
        RAISE EXCEPTION 'No mapped data provided for insert';
    END IF;

    v_sql := format('
        INSERT INTO public.%I (%s)
        SELECT %s FROM jsonb_populate_record(null::public.%I, $1)
        RETURNING id
    ', v_target_table, v_keys, v_keys, v_target_table);

    EXECUTE v_sql INTO v_imported_record_id USING p_mapped_data;

    UPDATE public.tally_submissions 
    SET status = 'imported', 
        imported_record_id = v_imported_record_id, 
        imported_by = p_imported_by, 
        imported_at = now() 
    WHERE id = p_submission_id;

    RETURN v_imported_record_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;
