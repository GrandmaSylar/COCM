drop extension if exists "pg_net";

drop policy "Authenticated users can view activity log config" on "public"."activity_log_config";

drop policy "Authenticated users can view notification config" on "public"."notification_type_config";

alter table "public"."members" drop constraint "members_zone_check";

alter table "public"."system_dropdown_options" drop constraint "system_dropdown_options_created_by_fkey";

alter table "public"."user_settings" drop constraint "user_settings_default_paper_size_check";

alter table "public"."visitors" drop constraint "visitors_potential_zone_check";

alter table "public"."absentee_records" drop constraint "absentee_records_reason_check";

alter table "public"."family_members" drop constraint "family_members_linked_member_id_fkey";

alter table "public"."members" drop constraint "members_status_check";

alter table "public"."otp_codes" drop constraint "otp_codes_method_check";

alter table "public"."user_tab_access" drop constraint "user_tab_access_tab_check";


  create table "public"."activity_log_visibility_config" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "action_category" text not null,
    "label" text not null,
    "description" text,
    "allowed_roles" text[] default '{dev,admin}'::text[],
    "allowed_user_ids" uuid[] default '{}'::uuid[],
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."activity_log_visibility_config" enable row level security;


  create table "public"."children_attendance_entries" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "attendance_record_id" uuid,
    "child_member_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."children_attendance_entries" enable row level security;


  create table "public"."children_attendance_records" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "date" date not null,
    "service_type" text not null,
    "total_count" integer not null default 0,
    "visitors_count" integer not null default 0,
    "created_at" timestamp with time zone default now(),
    "created_by" uuid
      );


alter table "public"."children_attendance_records" enable row level security;


  create table "public"."children_giving_records" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "service_date" date not null,
    "service_type" text not null,
    "offering_amount" numeric(10,2) default 0,
    "total_amount" numeric(10,2) not null default 0,
    "cash_amount" numeric(10,2) default 0,
    "mobile_money_amount" numeric(10,2) default 0,
    "notes" text,
    "created_at" timestamp with time zone default now(),
    "created_by" uuid
      );


alter table "public"."children_giving_records" enable row level security;


  create table "public"."expense_requisitions" (
    "id" uuid not null default gen_random_uuid(),
    "reference_no" text not null,
    "service_date" date not null,
    "service_type" text not null,
    "details" text not null,
    "amount" numeric(12,2) not null,
    "payment_method" text not null,
    "reference_number" text,
    "status" text not null default 'approved'::text,
    "requested_by" uuid,
    "recommended_by" uuid,
    "approved_by" uuid,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."expense_requisitions" enable row level security;


  create table "public"."system_settings" (
    "key" text not null,
    "value" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."system_settings" enable row level security;

alter table "public"."children_member_parents" add column "child_member_id" uuid;

alter table "public"."children_member_parents" add column "created_at" timestamp with time zone default now();

alter table "public"."children_member_parents" add column "first_name" text not null;

alter table "public"."children_member_parents" add column "is_linked" boolean default false;

alter table "public"."children_member_parents" add column "last_name" text not null;

alter table "public"."children_member_parents" add column "linked_member_id" uuid;

alter table "public"."children_member_parents" add column "relationship" text not null;

alter table "public"."children_member_parents" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."children_member_parents" enable row level security;

alter table "public"."children_members" add column "converted_member_id" uuid;

alter table "public"."children_members" add column "converted_to_member" boolean default false;

alter table "public"."children_members" add column "created_at" timestamp with time zone default now();

alter table "public"."children_members" add column "created_by" uuid;

alter table "public"."children_members" add column "date_of_birth" date not null;

alter table "public"."children_members" add column "first_name" text not null;

alter table "public"."children_members" add column "gender" text;

alter table "public"."children_members" add column "join_date" date not null default CURRENT_DATE;

alter table "public"."children_members" add column "last_name" text not null;

alter table "public"."children_members" add column "legal_info" jsonb;

alter table "public"."children_members" add column "ministries" jsonb default '["Children''s Ministry"]'::jsonb;

alter table "public"."children_members" add column "notes" text;

alter table "public"."children_members" add column "other_names" text;

alter table "public"."children_members" add column "photo_url" text;

alter table "public"."children_members" add column "position" text;

alter table "public"."children_members" add column "residence_location" text;

alter table "public"."children_members" add column "status" text not null default 'active'::text;

alter table "public"."children_members" add column "updated_at" timestamp with time zone default now();

alter table "public"."children_members" add column "zone" text;

alter table "public"."children_members" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."children_members" enable row level security;

alter table "public"."children_visitors" add column "converted_member_id" uuid;

alter table "public"."children_visitors" add column "converted_to_member" boolean default false;

alter table "public"."children_visitors" add column "created_at" timestamp with time zone default now();

alter table "public"."children_visitors" add column "created_by" uuid;

alter table "public"."children_visitors" add column "date_of_birth" date;

alter table "public"."children_visitors" add column "first_name" text not null;

alter table "public"."children_visitors" add column "gender" text;

alter table "public"."children_visitors" add column "last_name" text not null;

alter table "public"."children_visitors" add column "notes" text;

alter table "public"."children_visitors" add column "other_names" text;

alter table "public"."children_visitors" add column "phone" text;

alter table "public"."children_visitors" add column "referred_by" text;

alter table "public"."children_visitors" add column "residence_location" text;

alter table "public"."children_visitors" add column "updated_at" timestamp with time zone default now();

alter table "public"."children_visitors" add column "visit_date" date not null;

alter table "public"."children_visitors" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."children_visitors" enable row level security;

alter table "public"."family_members" add column "hometown" text;

alter table "public"."family_members" add column "occupation" text;

alter table "public"."members" add column "hometown" text;

alter table "public"."members" add column "leave_end_date" date;

alter table "public"."members" add column "leave_start_date" date;

alter table "public"."members" add column "occupation" text;

alter table "public"."members" add column "position" text;

alter table "public"."notification_type_config" drop column "created_at";

alter table "public"."notification_type_config" add column "category" text not null;

alter table "public"."notification_type_config" add column "description" text;

alter table "public"."notification_type_config" add column "label" text not null;

alter table "public"."notification_type_config" alter column "allowed_roles" set default '{}'::text[];

alter table "public"."notification_type_config" alter column "allowed_roles" set data type text[] using "allowed_roles"::text[];

alter table "public"."notification_type_config" alter column "allowed_user_ids" set default '{}'::uuid[];

alter table "public"."notification_type_config" alter column "allowed_user_ids" set data type uuid[] using "allowed_user_ids"::uuid[];

alter table "public"."notification_type_config" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."profiles" add column "active_device_id" text;

alter table "public"."system_dropdown_options" drop column "created_by";

alter table "public"."system_dropdown_options" alter column "is_active" set not null;

alter table "public"."tally_form_configs" enable row level security;

alter table "public"."tally_submissions" enable row level security;

alter table "public"."user_settings" alter column "default_paper_size" drop not null;

CREATE UNIQUE INDEX activity_log_visibility_config_action_category_key ON public.activity_log_visibility_config USING btree (action_category);

CREATE UNIQUE INDEX activity_log_visibility_config_pkey ON public.activity_log_visibility_config USING btree (id);

CREATE UNIQUE INDEX children_attendance_entries_attendance_record_id_child_memb_key ON public.children_attendance_entries USING btree (attendance_record_id, child_member_id);

CREATE UNIQUE INDEX children_attendance_entries_pkey ON public.children_attendance_entries USING btree (id);

CREATE UNIQUE INDEX children_attendance_records_date_service_type_key ON public.children_attendance_records USING btree (date, service_type);

CREATE UNIQUE INDEX children_attendance_records_pkey ON public.children_attendance_records USING btree (id);

CREATE UNIQUE INDEX children_giving_records_pkey ON public.children_giving_records USING btree (id);

CREATE UNIQUE INDEX children_giving_records_service_date_service_type_key ON public.children_giving_records USING btree (service_date, service_type);

CREATE UNIQUE INDEX expense_requisitions_pkey ON public.expense_requisitions USING btree (id);

CREATE UNIQUE INDEX expense_requisitions_reference_no_key ON public.expense_requisitions USING btree (reference_no);

CREATE INDEX idx_members_baptism_info_gin ON public.members USING gin (baptism_info);

CREATE INDEX idx_members_baptism_year_expr ON public.members USING btree (((baptism_info ->> 'year'::text)));

CREATE INDEX idx_members_created_at ON public.members USING btree (created_at);

CREATE INDEX idx_members_date_of_birth ON public.members USING btree (date_of_birth);

CREATE INDEX idx_members_join_date ON public.members USING btree (join_date);

CREATE INDEX idx_members_ministries_gin ON public.members USING gin (ministries);

CREATE INDEX idx_members_zone_status ON public.members USING btree (zone, status);

CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (key);

alter table "public"."activity_log_visibility_config" add constraint "activity_log_visibility_config_pkey" PRIMARY KEY using index "activity_log_visibility_config_pkey";

alter table "public"."children_attendance_entries" add constraint "children_attendance_entries_pkey" PRIMARY KEY using index "children_attendance_entries_pkey";

alter table "public"."children_attendance_records" add constraint "children_attendance_records_pkey" PRIMARY KEY using index "children_attendance_records_pkey";

alter table "public"."children_giving_records" add constraint "children_giving_records_pkey" PRIMARY KEY using index "children_giving_records_pkey";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_pkey" PRIMARY KEY using index "expense_requisitions_pkey";

alter table "public"."system_settings" add constraint "system_settings_pkey" PRIMARY KEY using index "system_settings_pkey";

alter table "public"."activity_log_visibility_config" add constraint "activity_log_visibility_config_action_category_key" UNIQUE using index "activity_log_visibility_config_action_category_key";

alter table "public"."children_attendance_entries" add constraint "children_attendance_entries_attendance_record_id_child_memb_key" UNIQUE using index "children_attendance_entries_attendance_record_id_child_memb_key";

alter table "public"."children_attendance_entries" add constraint "children_attendance_entries_attendance_record_id_fkey" FOREIGN KEY (attendance_record_id) REFERENCES public.children_attendance_records(id) ON DELETE CASCADE not valid;

alter table "public"."children_attendance_entries" validate constraint "children_attendance_entries_attendance_record_id_fkey";

alter table "public"."children_attendance_entries" add constraint "children_attendance_entries_child_member_id_fkey" FOREIGN KEY (child_member_id) REFERENCES public.children_members(id) ON DELETE CASCADE not valid;

alter table "public"."children_attendance_entries" validate constraint "children_attendance_entries_child_member_id_fkey";

alter table "public"."children_attendance_records" add constraint "children_attendance_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "public"."children_attendance_records" validate constraint "children_attendance_records_created_by_fkey";

alter table "public"."children_attendance_records" add constraint "children_attendance_records_date_service_type_key" UNIQUE using index "children_attendance_records_date_service_type_key";

alter table "public"."children_giving_records" add constraint "children_giving_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "public"."children_giving_records" validate constraint "children_giving_records_created_by_fkey";

alter table "public"."children_giving_records" add constraint "children_giving_records_service_date_service_type_key" UNIQUE using index "children_giving_records_service_date_service_type_key";

alter table "public"."children_member_parents" add constraint "children_member_parents_child_member_id_fkey" FOREIGN KEY (child_member_id) REFERENCES public.children_members(id) ON DELETE CASCADE not valid;

alter table "public"."children_member_parents" validate constraint "children_member_parents_child_member_id_fkey";

alter table "public"."children_member_parents" add constraint "children_member_parents_linked_member_id_fkey" FOREIGN KEY (linked_member_id) REFERENCES public.members(id) not valid;

alter table "public"."children_member_parents" validate constraint "children_member_parents_linked_member_id_fkey";

alter table "public"."children_member_parents" add constraint "children_member_parents_relationship_check" CHECK ((relationship = ANY (ARRAY['mother'::text, 'father'::text, 'guardian'::text]))) not valid;

alter table "public"."children_member_parents" validate constraint "children_member_parents_relationship_check";

alter table "public"."children_members" add constraint "children_members_converted_member_id_fkey" FOREIGN KEY (converted_member_id) REFERENCES public.members(id) not valid;

alter table "public"."children_members" validate constraint "children_members_converted_member_id_fkey";

alter table "public"."children_members" add constraint "children_members_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "public"."children_members" validate constraint "children_members_created_by_fkey";

alter table "public"."children_members" add constraint "children_members_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text]))) not valid;

alter table "public"."children_members" validate constraint "children_members_gender_check";

alter table "public"."children_members" add constraint "children_members_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'semi-active'::text, 'inactive'::text, 'new'::text, 'sick'::text, 'studies'::text, 'traveled'::text, 'blacklisted'::text]))) not valid;

alter table "public"."children_members" validate constraint "children_members_status_check";

alter table "public"."children_members" add constraint "children_members_zone_check" CHECK ((zone = ANY (ARRAY['A'::text, 'B'::text, 'F'::text, 'K'::text, 'M'::text, 'R'::text]))) not valid;

alter table "public"."children_members" validate constraint "children_members_zone_check";

alter table "public"."children_visitors" add constraint "children_visitors_converted_member_id_fkey" FOREIGN KEY (converted_member_id) REFERENCES public.children_members(id) not valid;

alter table "public"."children_visitors" validate constraint "children_visitors_converted_member_id_fkey";

alter table "public"."children_visitors" add constraint "children_visitors_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "public"."children_visitors" validate constraint "children_visitors_created_by_fkey";

alter table "public"."children_visitors" add constraint "children_visitors_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text]))) not valid;

alter table "public"."children_visitors" validate constraint "children_visitors_gender_check";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_amount_check" CHECK ((amount > (0)::numeric)) not valid;

alter table "public"."expense_requisitions" validate constraint "expense_requisitions_amount_check";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.members(id) ON DELETE SET NULL not valid;

alter table "public"."expense_requisitions" validate constraint "expense_requisitions_approved_by_fkey";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."expense_requisitions" validate constraint "expense_requisitions_created_by_fkey";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_recommended_by_fkey" FOREIGN KEY (recommended_by) REFERENCES public.members(id) ON DELETE SET NULL not valid;

alter table "public"."expense_requisitions" validate constraint "expense_requisitions_recommended_by_fkey";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_reference_no_key" UNIQUE using index "expense_requisitions_reference_no_key";

alter table "public"."expense_requisitions" add constraint "expense_requisitions_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES public.members(id) ON DELETE SET NULL not valid;

alter table "public"."expense_requisitions" validate constraint "expense_requisitions_requested_by_fkey";

alter table "public"."absentee_records" add constraint "absentee_records_reason_check" CHECK (((reason IS NULL) OR (reason = ANY (ARRAY['Sick'::text, 'Traveled'::text, 'Schooling'::text, 'Work'::text, 'Family Emergency'::text, 'Other'::text])))) not valid;

alter table "public"."absentee_records" validate constraint "absentee_records_reason_check";

alter table "public"."family_members" add constraint "family_members_linked_member_id_fkey" FOREIGN KEY (linked_member_id) REFERENCES public.members(id) ON DELETE SET NULL not valid;

alter table "public"."family_members" validate constraint "family_members_linked_member_id_fkey";

alter table "public"."members" add constraint "members_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'active'::text, 'semi-active'::text, 'inactive'::text, 'blacklisted'::text, 'sick'::text, 'traveled'::text, 'schooling'::text, 'not baptised'::text]))) not valid;

alter table "public"."members" validate constraint "members_status_check";

alter table "public"."otp_codes" add constraint "otp_codes_method_check" CHECK ((method = ANY (ARRAY['email'::text, 'phone'::text, 'pending'::text, 'password_reset'::text]))) not valid;

alter table "public"."otp_codes" validate constraint "otp_codes_method_check";

alter table "public"."user_tab_access" add constraint "user_tab_access_tab_check" CHECK ((tab = ANY (ARRAY['members'::text, 'visitors'::text, 'attendance'::text, 'giving'::text, 'reports'::text, 'services'::text, 'activity-log'::text, 'children'::text, 'expenses'::text]))) not valid;

alter table "public"."user_tab_access" validate constraint "user_tab_access_tab_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_expense_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < NOW() OR used = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_member_txn(target_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Clean up inverse links
  DELETE FROM family_members WHERE linked_member_id = target_member_id;
  DELETE FROM children_member_parents WHERE linked_member_id = target_member_id;

  -- Delete the member row
  DELETE FROM members WHERE id = target_member_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_import_tally_submission(p_submission_id uuid, p_mapped_data jsonb, p_context_type text, p_imported_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

grant delete on table "public"."activity_log_visibility_config" to "anon";

grant insert on table "public"."activity_log_visibility_config" to "anon";

grant references on table "public"."activity_log_visibility_config" to "anon";

grant select on table "public"."activity_log_visibility_config" to "anon";

grant trigger on table "public"."activity_log_visibility_config" to "anon";

grant truncate on table "public"."activity_log_visibility_config" to "anon";

grant update on table "public"."activity_log_visibility_config" to "anon";

grant delete on table "public"."activity_log_visibility_config" to "authenticated";

grant insert on table "public"."activity_log_visibility_config" to "authenticated";

grant references on table "public"."activity_log_visibility_config" to "authenticated";

grant select on table "public"."activity_log_visibility_config" to "authenticated";

grant trigger on table "public"."activity_log_visibility_config" to "authenticated";

grant truncate on table "public"."activity_log_visibility_config" to "authenticated";

grant update on table "public"."activity_log_visibility_config" to "authenticated";

grant delete on table "public"."activity_log_visibility_config" to "service_role";

grant insert on table "public"."activity_log_visibility_config" to "service_role";

grant references on table "public"."activity_log_visibility_config" to "service_role";

grant select on table "public"."activity_log_visibility_config" to "service_role";

grant trigger on table "public"."activity_log_visibility_config" to "service_role";

grant truncate on table "public"."activity_log_visibility_config" to "service_role";

grant update on table "public"."activity_log_visibility_config" to "service_role";

grant delete on table "public"."children_attendance_entries" to "anon";

grant insert on table "public"."children_attendance_entries" to "anon";

grant references on table "public"."children_attendance_entries" to "anon";

grant select on table "public"."children_attendance_entries" to "anon";

grant trigger on table "public"."children_attendance_entries" to "anon";

grant truncate on table "public"."children_attendance_entries" to "anon";

grant update on table "public"."children_attendance_entries" to "anon";

grant delete on table "public"."children_attendance_entries" to "authenticated";

grant insert on table "public"."children_attendance_entries" to "authenticated";

grant references on table "public"."children_attendance_entries" to "authenticated";

grant select on table "public"."children_attendance_entries" to "authenticated";

grant trigger on table "public"."children_attendance_entries" to "authenticated";

grant truncate on table "public"."children_attendance_entries" to "authenticated";

grant update on table "public"."children_attendance_entries" to "authenticated";

grant delete on table "public"."children_attendance_entries" to "service_role";

grant insert on table "public"."children_attendance_entries" to "service_role";

grant references on table "public"."children_attendance_entries" to "service_role";

grant select on table "public"."children_attendance_entries" to "service_role";

grant trigger on table "public"."children_attendance_entries" to "service_role";

grant truncate on table "public"."children_attendance_entries" to "service_role";

grant update on table "public"."children_attendance_entries" to "service_role";

grant delete on table "public"."children_attendance_records" to "anon";

grant insert on table "public"."children_attendance_records" to "anon";

grant references on table "public"."children_attendance_records" to "anon";

grant select on table "public"."children_attendance_records" to "anon";

grant trigger on table "public"."children_attendance_records" to "anon";

grant truncate on table "public"."children_attendance_records" to "anon";

grant update on table "public"."children_attendance_records" to "anon";

grant delete on table "public"."children_attendance_records" to "authenticated";

grant insert on table "public"."children_attendance_records" to "authenticated";

grant references on table "public"."children_attendance_records" to "authenticated";

grant select on table "public"."children_attendance_records" to "authenticated";

grant trigger on table "public"."children_attendance_records" to "authenticated";

grant truncate on table "public"."children_attendance_records" to "authenticated";

grant update on table "public"."children_attendance_records" to "authenticated";

grant delete on table "public"."children_attendance_records" to "service_role";

grant insert on table "public"."children_attendance_records" to "service_role";

grant references on table "public"."children_attendance_records" to "service_role";

grant select on table "public"."children_attendance_records" to "service_role";

grant trigger on table "public"."children_attendance_records" to "service_role";

grant truncate on table "public"."children_attendance_records" to "service_role";

grant update on table "public"."children_attendance_records" to "service_role";

grant delete on table "public"."children_giving_records" to "anon";

grant insert on table "public"."children_giving_records" to "anon";

grant references on table "public"."children_giving_records" to "anon";

grant select on table "public"."children_giving_records" to "anon";

grant trigger on table "public"."children_giving_records" to "anon";

grant truncate on table "public"."children_giving_records" to "anon";

grant update on table "public"."children_giving_records" to "anon";

grant delete on table "public"."children_giving_records" to "authenticated";

grant insert on table "public"."children_giving_records" to "authenticated";

grant references on table "public"."children_giving_records" to "authenticated";

grant select on table "public"."children_giving_records" to "authenticated";

grant trigger on table "public"."children_giving_records" to "authenticated";

grant truncate on table "public"."children_giving_records" to "authenticated";

grant update on table "public"."children_giving_records" to "authenticated";

grant delete on table "public"."children_giving_records" to "service_role";

grant insert on table "public"."children_giving_records" to "service_role";

grant references on table "public"."children_giving_records" to "service_role";

grant select on table "public"."children_giving_records" to "service_role";

grant trigger on table "public"."children_giving_records" to "service_role";

grant truncate on table "public"."children_giving_records" to "service_role";

grant update on table "public"."children_giving_records" to "service_role";

grant delete on table "public"."expense_requisitions" to "anon";

grant insert on table "public"."expense_requisitions" to "anon";

grant references on table "public"."expense_requisitions" to "anon";

grant select on table "public"."expense_requisitions" to "anon";

grant trigger on table "public"."expense_requisitions" to "anon";

grant truncate on table "public"."expense_requisitions" to "anon";

grant update on table "public"."expense_requisitions" to "anon";

grant delete on table "public"."expense_requisitions" to "authenticated";

grant insert on table "public"."expense_requisitions" to "authenticated";

grant references on table "public"."expense_requisitions" to "authenticated";

grant select on table "public"."expense_requisitions" to "authenticated";

grant trigger on table "public"."expense_requisitions" to "authenticated";

grant truncate on table "public"."expense_requisitions" to "authenticated";

grant update on table "public"."expense_requisitions" to "authenticated";

grant delete on table "public"."expense_requisitions" to "service_role";

grant insert on table "public"."expense_requisitions" to "service_role";

grant references on table "public"."expense_requisitions" to "service_role";

grant select on table "public"."expense_requisitions" to "service_role";

grant trigger on table "public"."expense_requisitions" to "service_role";

grant truncate on table "public"."expense_requisitions" to "service_role";

grant update on table "public"."expense_requisitions" to "service_role";

grant delete on table "public"."system_settings" to "anon";

grant insert on table "public"."system_settings" to "anon";

grant references on table "public"."system_settings" to "anon";

grant select on table "public"."system_settings" to "anon";

grant trigger on table "public"."system_settings" to "anon";

grant truncate on table "public"."system_settings" to "anon";

grant update on table "public"."system_settings" to "anon";

grant delete on table "public"."system_settings" to "authenticated";

grant insert on table "public"."system_settings" to "authenticated";

grant references on table "public"."system_settings" to "authenticated";

grant select on table "public"."system_settings" to "authenticated";

grant trigger on table "public"."system_settings" to "authenticated";

grant truncate on table "public"."system_settings" to "authenticated";

grant update on table "public"."system_settings" to "authenticated";

grant delete on table "public"."system_settings" to "service_role";

grant insert on table "public"."system_settings" to "service_role";

grant references on table "public"."system_settings" to "service_role";

grant select on table "public"."system_settings" to "service_role";

grant trigger on table "public"."system_settings" to "service_role";

grant truncate on table "public"."system_settings" to "service_role";

grant update on table "public"."system_settings" to "service_role";


  create policy "Authenticated can read activity_log_visibility_config"
  on "public"."activity_log_visibility_config"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages activity_log_visibility_config"
  on "public"."activity_log_visibility_config"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Authenticated users can read children_attendance_entries"
  on "public"."children_attendance_entries"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages children_attendance_entries"
  on "public"."children_attendance_entries"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Authenticated users can read children_attendance_records"
  on "public"."children_attendance_records"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages children_attendance_records"
  on "public"."children_attendance_records"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Authenticated users can read children_giving_records"
  on "public"."children_giving_records"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages children_giving_records"
  on "public"."children_giving_records"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Authenticated users can read children_member_parents"
  on "public"."children_member_parents"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages children_member_parents"
  on "public"."children_member_parents"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Authenticated users can read children_members"
  on "public"."children_members"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages children_members"
  on "public"."children_members"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Authenticated users can read children_visitors"
  on "public"."children_visitors"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages children_visitors"
  on "public"."children_visitors"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "expenses_delete"
  on "public"."expense_requisitions"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'dev'::text]))))));



  create policy "expenses_insert"
  on "public"."expense_requisitions"
  as permissive
  for insert
  to authenticated
with check (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'dev'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.user_tab_access
  WHERE ((user_tab_access.user_id = auth.uid()) AND (user_tab_access.tab = 'expenses'::text))))));



  create policy "expenses_read"
  on "public"."expense_requisitions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "expenses_update"
  on "public"."expense_requisitions"
  as permissive
  for update
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'dev'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.user_tab_access
  WHERE ((user_tab_access.user_id = auth.uid()) AND (user_tab_access.tab = 'expenses'::text))))));



  create policy "Authenticated can read notification_type_config"
  on "public"."notification_type_config"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role manages notification_type_config"
  on "public"."notification_type_config"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Enable delete for dev on options"
  on "public"."system_dropdown_options"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::text)))));



  create policy "Enable insert for dev on options"
  on "public"."system_dropdown_options"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::text)))));



  create policy "Enable read access for authenticated users on options"
  on "public"."system_dropdown_options"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Enable update for dev on options"
  on "public"."system_dropdown_options"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::text)))));



  create policy "Allow full access for devs"
  on "public"."system_settings"
  as permissive
  for all
  to authenticated
using ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'dev'::text));



  create policy "Allow read access to all authenticated users"
  on "public"."system_settings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can read system settings"
  on "public"."system_settings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Devs can manage system settings"
  on "public"."system_settings"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'dev'::text)))));


CREATE TRIGGER trg_expense_updated_at BEFORE UPDATE ON public.expense_requisitions FOR EACH ROW EXECUTE FUNCTION public.set_expense_updated_at();

CREATE TRIGGER update_system_settings_modtime BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_system_settings_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

drop policy "Authenticated users can delete member photos" on "storage"."objects";

drop policy "Authenticated users can update member photos" on "storage"."objects";

drop policy "Authenticated users can upload member photos" on "storage"."objects";


  create policy "Authenticated users can delete member photos"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'member-photos'::text) AND public.has_permission(auth.uid(), 'delete_members'::text)));



  create policy "Authenticated users can update member photos"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'member-photos'::text) AND public.has_permission(auth.uid(), 'manage_members'::text)));



  create policy "Authenticated users can upload member photos"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'member-photos'::text) AND public.has_permission(auth.uid(), 'manage_members'::text)));



