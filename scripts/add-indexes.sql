-- Rutiini: suorituskykyindeksit
--
-- Luo indeksit tuotantokantaan ILMAN taulujen lukitsemista.
-- CREATE INDEX CONCURRENTLY ei voi ajaa transaktiossa, joten AJA ILMAN -1 / --single-transaction lippua:
--
--   psql "$DATABASE_URL" -f scripts/add-indexes.sql
--
-- Skripti on idempotentti (IF NOT EXISTS): sen voi ajaa uudelleen turvallisesti.
-- Jos jokin indeksi jaa "invalid"-tilaan keskeytyksen takia, pudota se
-- (DROP INDEX CONCURRENTLY <nimi>) ja aja skripti uudelleen.
--
-- Vastaa shared/schema.ts:n indeksimaarityksia. Uudessa kannassa
-- `npm run db:push` luo namat automaattisesti eika tata skriptia tarvita.


-- absences
CREATE INDEX CONCURRENTLY IF NOT EXISTS "absences_daycare_id_date_idx" ON "absences" USING btree ("daycare_id","date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "absences_child_id_date_idx" ON "absences" USING btree ("child_id","date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "absences_date_idx" ON "absences" USING btree ("date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "absences_reported_by_id_idx" ON "absences" USING btree ("reported_by_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "absences_created_at_idx" ON "absences" USING btree ("created_at");

-- audit_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_daycare_id_timestamp_idx" ON "audit_logs" USING btree ("daycare_id","timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");

-- child_consents
CREATE INDEX CONCURRENTLY IF NOT EXISTS "child_consents_child_id_consent_type_idx" ON "child_consents" USING btree ("child_id","consent_type");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "child_consents_daycare_id_idx" ON "child_consents" USING btree ("daycare_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "child_consents_granted_by_id_idx" ON "child_consents" USING btree ("granted_by_id");

-- children
CREATE INDEX CONCURRENTLY IF NOT EXISTS "children_daycare_id_idx" ON "children" USING btree ("daycare_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "children_group_id_idx" ON "children" USING btree ("group_id");

-- daycare_groups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "daycare_groups_daycare_id_idx" ON "daycare_groups" USING btree ("daycare_id");

-- daycares
CREATE INDEX CONCURRENTLY IF NOT EXISTS "daycares_municipality_id_idx" ON "daycares" USING btree ("municipality_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "daycares_municipality_idx" ON "daycares" USING btree ("municipality");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "daycares_menu_source_type_idx" ON "daycares" USING btree ("menu_source_type");

-- delete_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delete_requests_status_created_at_idx" ON "delete_requests" USING btree ("status","created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delete_requests_user_id_idx" ON "delete_requests" USING btree ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delete_requests_daycare_id_idx" ON "delete_requests" USING btree ("daycare_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delete_requests_processed_by_id_idx" ON "delete_requests" USING btree ("processed_by_id");

-- documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS "documents_daycare_id_published_at_idx" ON "documents" USING btree ("daycare_id","published_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "documents_published_by_id_idx" ON "documents" USING btree ("published_by_id");

-- entries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "entries_child_id_timestamp_idx" ON "entries" USING btree ("child_id","timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "entries_timestamp_idx" ON "entries" USING btree ("timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "entries_staff_id_idx" ON "entries" USING btree ("staff_id");

-- form_submissions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "form_submissions_form_id_submitted_at_idx" ON "form_submissions" USING btree ("form_id","submitted_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "form_submissions_daycare_id_submitted_at_idx" ON "form_submissions" USING btree ("daycare_id","submitted_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "form_submissions_submitted_by_id_idx" ON "form_submissions" USING btree ("submitted_by_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "form_submissions_child_id_idx" ON "form_submissions" USING btree ("child_id");

-- forms
CREATE INDEX CONCURRENTLY IF NOT EXISTS "forms_daycare_id_is_active_idx" ON "forms" USING btree ("daycare_id","is_active");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "forms_created_by_id_idx" ON "forms" USING btree ("created_by_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "forms_created_at_idx" ON "forms" USING btree ("created_at");

-- guardians
CREATE INDEX CONCURRENTLY IF NOT EXISTS "guardians_user_id_idx" ON "guardians" USING btree ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "guardians_child_id_idx" ON "guardians" USING btree ("child_id");

-- meal_menus
CREATE INDEX CONCURRENTLY IF NOT EXISTS "meal_menus_daycare_id_date_idx" ON "meal_menus" USING btree ("daycare_id","date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "meal_menus_date_idx" ON "meal_menus" USING btree ("date");

-- messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_daycare_id_created_at_idx" ON "messages" USING btree ("daycare_id","created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_recipient_id_created_at_idx" ON "messages" USING btree ("recipient_id","created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_sender_id_created_at_idx" ON "messages" USING btree ("sender_id","created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_sender_recipient_idx" ON "messages" USING btree ("sender_id","recipient_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_child_id_idx" ON "messages" USING btree ("child_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_created_at_idx" ON "messages" USING btree ("created_at");

-- notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_user_id_read_idx" ON "notifications" USING btree ("user_id","read");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_daycare_id_idx" ON "notifications" USING btree ("daycare_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at");

-- push_tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" USING btree ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "push_tokens_token_idx" ON "push_tokens" USING btree ("token");

-- session_tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS "session_tokens_user_id_idx" ON "session_tokens" USING btree ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "session_tokens_expires_at_idx" ON "session_tokens" USING btree ("expires_at");

-- teacher_group_assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "teacher_group_assignments_user_id_idx" ON "teacher_group_assignments" USING btree ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "teacher_group_assignments_group_id_idx" ON "teacher_group_assignments" USING btree ("group_id");

-- trip_responses
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trip_responses_trip_id_idx" ON "trip_responses" USING btree ("trip_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trip_responses_guardian_id_idx" ON "trip_responses" USING btree ("guardian_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trip_responses_child_id_idx" ON "trip_responses" USING btree ("child_id");

-- trips
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trips_daycare_id_date_idx" ON "trips" USING btree ("daycare_id","date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trips_created_by_idx" ON "trips" USING btree ("created_by");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "trips_created_at_idx" ON "trips" USING btree ("created_at");

-- users
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_daycare_id_role_idx" ON "users" USING btree ("daycare_id","role");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_reset_token_hash_idx" ON "users" USING btree ("reset_token_hash");

ANALYZE;
