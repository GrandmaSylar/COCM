


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."cleanup_expired_permissions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM temporary_permissions WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;


ALTER FUNCTION "public"."get_user_role"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("user_id" "uuid", "permission_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
  has_temp_perm BOOLEAN;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  
  IF user_role = 'dev' THEN
    RETURN true;
  END IF;
  
  IF user_role = 'admin' AND permission_name IN (
    'manage_users', 'manage_members', 'view_members', 'edit_members', 'delete_members',
    'manage_attendance', 'view_attendance', 'record_attendance',
    'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
    'view_reports', 'manage_settings', 'manage_services', 'grant_permissions'
  ) THEN
    RETURN true;
  END IF;
  
  IF user_role IN ('pastor', 'elder') AND permission_name IN (
    'view_members', 'view_attendance', 'view_giving', 'view_reports'
  ) THEN
    RETURN true;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM temporary_permissions
    WHERE temporary_permissions.user_id = has_permission.user_id 
    AND permission = permission_name 
    AND expires_at > NOW()
  ) INTO has_temp_perm;
  
  RETURN has_temp_perm;
END;
$$;


ALTER FUNCTION "public"."has_permission"("user_id" "uuid", "permission_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_attendance_total_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE attendance_records
  SET total_count = (
    SELECT COUNT(*) FROM attendance_entries 
    WHERE attendance_record_id = NEW.attendance_record_id
  )
  WHERE id = NEW.attendance_record_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_attendance_total_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attendance_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "attendance_record_id" "uuid",
    "member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "date" "date" NOT NULL,
    "service_type" "text" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "total_count" integer DEFAULT 0 NOT NULL,
    "is_custom_service" boolean DEFAULT false,
    "custom_service_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."attendance_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_giving_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_giving_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "days_of_week" integer[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid",
    "relationship" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "other_names" "text",
    "phone" "text",
    "is_linked" boolean DEFAULT false,
    "linked_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "family_members_relationship_check" CHECK (("relationship" = ANY (ARRAY['mother'::"text", 'father'::"text", 'spouse'::"text", 'child'::"text", 'sibling'::"text"])))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."giving_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "service_name" "text" NOT NULL,
    "service_date" "date" NOT NULL,
    "service_type" "text" NOT NULL,
    "offering_amount" numeric(10,2) DEFAULT 0,
    "donation_amount" numeric(10,2) DEFAULT 0,
    "thanksgiving_amount" numeric(10,2) DEFAULT 0,
    "custom_types" "jsonb" DEFAULT '{}'::"jsonb",
    "total_amount" numeric(10,2) NOT NULL,
    "cash_amount" numeric(10,2) DEFAULT 0,
    "mobile_money_amount" numeric(10,2) DEFAULT 0,
    "card_amount" numeric(10,2) DEFAULT 0,
    "bank_transfer_amount" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "giving_records_service_type_check" CHECK (("service_type" = ANY (ARRAY['sunday_morning'::"text", 'sunday_evening'::"text", 'midweek'::"text", 'special'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."giving_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "other_names" "text",
    "email" "text",
    "phone" "text" NOT NULL,
    "second_phone" "text",
    "gender" "text",
    "date_of_birth" "date",
    "residence_location" "text" NOT NULL,
    "digital_address" "text",
    "zone" "text" NOT NULL,
    "zone_number" "text" NOT NULL,
    "notes" "text",
    "status" "text" NOT NULL,
    "join_date" "date" NOT NULL,
    "photo_url" "text",
    "baptism_info" "jsonb",
    "legal_info" "jsonb",
    "ministries" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "members_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'semi-active'::"text", 'inactive'::"text", 'sabbatical'::"text", 'blacklisted'::"text"]))),
    CONSTRAINT "members_zone_check" CHECK (("zone" = ANY (ARRAY['A'::"text", 'B'::"text", 'F'::"text", 'K'::"text", 'M'::"text", 'R'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['dev'::"text", 'admin'::"text", 'pastor'::"text", 'elder'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temporary_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "permission" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."temporary_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visitors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "other_names" "text",
    "email" "text",
    "phone" "text" NOT NULL,
    "second_phone" "text",
    "gender" "text",
    "date_of_birth" "date",
    "residence_location" "text" NOT NULL,
    "visit_date" "date" NOT NULL,
    "service_type" "text" NOT NULL,
    "referred_by" "text",
    "interested_in_membership" boolean DEFAULT false,
    "notes" "text",
    "follow_up_status" "text" NOT NULL,
    "potential_zone" "text",
    "converted_to_member" boolean DEFAULT false,
    "converted_member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "visitors_follow_up_status_check" CHECK (("follow_up_status" = ANY (ARRAY['pending'::"text", 'contacted'::"text", 'scheduled'::"text", 'completed'::"text"]))),
    CONSTRAINT "visitors_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "visitors_potential_zone_check" CHECK (("potential_zone" = ANY (ARRAY['A'::"text", 'B'::"text", 'F'::"text", 'K'::"text", 'M'::"text", 'R'::"text"])))
);


ALTER TABLE "public"."visitors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_attendance_record_id_member_id_key" UNIQUE ("attendance_record_id", "member_id");



ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_date_service_type_key" UNIQUE ("date", "service_type");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_giving_types"
    ADD CONSTRAINT "custom_giving_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."custom_giving_types"
    ADD CONSTRAINT "custom_giving_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."giving_records"
    ADD CONSTRAINT "giving_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."giving_records"
    ADD CONSTRAINT "giving_records_service_date_service_type_key" UNIQUE ("service_date", "service_type");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_zone_number_key" UNIQUE ("zone_number");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temporary_permissions"
    ADD CONSTRAINT "temporary_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitors"
    ADD CONSTRAINT "visitors_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_attendance_entries_member_id" ON "public"."attendance_entries" USING "btree" ("member_id");



CREATE INDEX "idx_attendance_entries_record_id" ON "public"."attendance_entries" USING "btree" ("attendance_record_id");



CREATE INDEX "idx_attendance_records_date" ON "public"."attendance_records" USING "btree" ("date");



CREATE INDEX "idx_attendance_records_service_type" ON "public"."attendance_records" USING "btree" ("service_type");



CREATE INDEX "idx_family_members_linked_member_id" ON "public"."family_members" USING "btree" ("linked_member_id");



CREATE INDEX "idx_family_members_member_id" ON "public"."family_members" USING "btree" ("member_id");



CREATE INDEX "idx_giving_records_service_date" ON "public"."giving_records" USING "btree" ("service_date");



CREATE INDEX "idx_giving_records_service_type" ON "public"."giving_records" USING "btree" ("service_type");



CREATE INDEX "idx_members_status" ON "public"."members" USING "btree" ("status");



CREATE INDEX "idx_members_zone" ON "public"."members" USING "btree" ("zone");



CREATE INDEX "idx_members_zone_number" ON "public"."members" USING "btree" ("zone_number");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_temp_permissions_expires_at" ON "public"."temporary_permissions" USING "btree" ("expires_at");



CREATE INDEX "idx_temp_permissions_user_id" ON "public"."temporary_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_visitors_follow_up_status" ON "public"."visitors" USING "btree" ("follow_up_status");



CREATE INDEX "idx_visitors_interested_in_membership" ON "public"."visitors" USING "btree" ("interested_in_membership");



CREATE INDEX "idx_visitors_visit_date" ON "public"."visitors" USING "btree" ("visit_date");



CREATE OR REPLACE TRIGGER "update_attendance_count_trigger" AFTER INSERT OR DELETE ON "public"."attendance_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_attendance_total_count"();



CREATE OR REPLACE TRIGGER "update_custom_giving_types_updated_at" BEFORE UPDATE ON "public"."custom_giving_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_custom_services_updated_at" BEFORE UPDATE ON "public"."custom_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_members_updated_at" BEFORE UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_visitors_updated_at" BEFORE UPDATE ON "public"."visitors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_custom_service_id_fkey" FOREIGN KEY ("custom_service_id") REFERENCES "public"."custom_services"("id");



ALTER TABLE ONLY "public"."custom_giving_types"
    ADD CONSTRAINT "custom_giving_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."custom_roles"
    ADD CONSTRAINT "custom_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."custom_services"
    ADD CONSTRAINT "custom_services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_linked_member_id_fkey" FOREIGN KEY ("linked_member_id") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."giving_records"
    ADD CONSTRAINT "giving_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."temporary_permissions"
    ADD CONSTRAINT "temporary_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."temporary_permissions"
    ADD CONSTRAINT "temporary_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visitors"
    ADD CONSTRAINT "visitors_converted_member_id_fkey" FOREIGN KEY ("converted_member_id") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."visitors"
    ADD CONSTRAINT "visitors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admins and Devs can update profiles" ON "public"."profiles" FOR UPDATE USING ("public"."has_permission"("auth"."uid"(), 'manage_users'::"text"));



CREATE POLICY "Admins can manage temp permissions" ON "public"."temporary_permissions" USING ("public"."has_permission"("auth"."uid"(), 'grant_permissions'::"text"));



CREATE POLICY "Anyone can view attendance" ON "public"."attendance_records" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'view_attendance'::"text"));



CREATE POLICY "Anyone can view custom roles" ON "public"."custom_roles" FOR SELECT USING (true);



CREATE POLICY "Anyone can view giving" ON "public"."giving_records" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'view_giving'::"text"));



CREATE POLICY "Anyone can view giving types" ON "public"."custom_giving_types" FOR SELECT USING (true);



CREATE POLICY "Anyone can view members" ON "public"."members" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'view_members'::"text"));



CREATE POLICY "Anyone can view services" ON "public"."custom_services" FOR SELECT USING (true);



CREATE POLICY "Authorized users can delete attendance" ON "public"."attendance_records" FOR DELETE USING ("public"."has_permission"("auth"."uid"(), 'manage_attendance'::"text"));



CREATE POLICY "Authorized users can delete giving" ON "public"."giving_records" FOR DELETE USING ("public"."has_permission"("auth"."uid"(), 'manage_giving'::"text"));



CREATE POLICY "Authorized users can delete members" ON "public"."members" FOR DELETE USING ("public"."has_permission"("auth"."uid"(), 'delete_members'::"text"));



CREATE POLICY "Authorized users can insert members" ON "public"."members" FOR INSERT WITH CHECK ("public"."has_permission"("auth"."uid"(), 'manage_members'::"text"));



CREATE POLICY "Authorized users can manage giving types" ON "public"."custom_giving_types" USING ("public"."has_permission"("auth"."uid"(), 'manage_giving_types'::"text"));



CREATE POLICY "Authorized users can manage services" ON "public"."custom_services" USING ("public"."has_permission"("auth"."uid"(), 'manage_services'::"text"));



CREATE POLICY "Authorized users can manage visitors" ON "public"."visitors" USING ("public"."has_permission"("auth"."uid"(), 'manage_members'::"text"));



CREATE POLICY "Authorized users can record attendance" ON "public"."attendance_records" FOR INSERT WITH CHECK ("public"."has_permission"("auth"."uid"(), 'record_attendance'::"text"));



CREATE POLICY "Authorized users can record giving" ON "public"."giving_records" FOR INSERT WITH CHECK ("public"."has_permission"("auth"."uid"(), 'record_giving'::"text"));



CREATE POLICY "Authorized users can update attendance" ON "public"."attendance_records" FOR UPDATE USING ("public"."has_permission"("auth"."uid"(), 'manage_attendance'::"text"));



CREATE POLICY "Authorized users can update giving" ON "public"."giving_records" FOR UPDATE USING ("public"."has_permission"("auth"."uid"(), 'manage_giving'::"text"));



CREATE POLICY "Authorized users can update members" ON "public"."members" FOR UPDATE USING ("public"."has_permission"("auth"."uid"(), 'edit_members'::"text"));



CREATE POLICY "Dev can manage custom roles" ON "public"."custom_roles" USING (("public"."get_user_role"("auth"."uid"()) = 'dev'::"text"));



CREATE POLICY "Manage attendance entries" ON "public"."attendance_entries" USING ("public"."has_permission"("auth"."uid"(), 'record_attendance'::"text"));



CREATE POLICY "Manage family members with member manage permission" ON "public"."family_members" USING ("public"."has_permission"("auth"."uid"(), 'manage_members'::"text"));



CREATE POLICY "Users can view all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "View attendance entries" ON "public"."attendance_entries" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'view_attendance'::"text"));



CREATE POLICY "View family members with member view permission" ON "public"."family_members" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'view_members'::"text"));



ALTER TABLE "public"."attendance_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_giving_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."giving_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temporary_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visitors" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."cleanup_expired_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("user_id" "uuid", "permission_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("user_id" "uuid", "permission_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("user_id" "uuid", "permission_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_attendance_total_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_attendance_total_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_attendance_total_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."attendance_entries" TO "anon";
GRANT ALL ON TABLE "public"."attendance_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_entries" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_records" TO "anon";
GRANT ALL ON TABLE "public"."attendance_records" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_records" TO "service_role";



GRANT ALL ON TABLE "public"."custom_giving_types" TO "anon";
GRANT ALL ON TABLE "public"."custom_giving_types" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_giving_types" TO "service_role";



GRANT ALL ON TABLE "public"."custom_roles" TO "anon";
GRANT ALL ON TABLE "public"."custom_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_roles" TO "service_role";



GRANT ALL ON TABLE "public"."custom_services" TO "anon";
GRANT ALL ON TABLE "public"."custom_services" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_services" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."giving_records" TO "anon";
GRANT ALL ON TABLE "public"."giving_records" TO "authenticated";
GRANT ALL ON TABLE "public"."giving_records" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."temporary_permissions" TO "anon";
GRANT ALL ON TABLE "public"."temporary_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."temporary_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."visitors" TO "anon";
GRANT ALL ON TABLE "public"."visitors" TO "authenticated";
GRANT ALL ON TABLE "public"."visitors" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
