CREATE TABLE "analytics_install_state" (
	"id" text PRIMARY KEY NOT NULL,
	"distinct_id" text NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	"raw_event_replay_version" integer DEFAULT 0 NOT NULL,
	"raw_event_replay_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_milestones" (
	"milestone" text PRIMARY KEY NOT NULL,
	"first_seen_at" bigint NOT NULL,
	"first_session_id" text,
	"reported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_server_event_replays" (
	"event_key" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"claimed_at" bigint,
	"reported_at" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"subject" text NOT NULL,
	"user_id" text,
	"expires_at" bigint NOT NULL,
	"revoked_at" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_resume_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"document_id" text NOT NULL,
	"kind" text DEFAULT 'picture' NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_resume_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"resume_json" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"source_resume_id" text,
	"source_mode" text,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"application_id" text NOT NULL,
	"scheduled_at" bigint NOT NULL,
	"duration_mins" integer,
	"type" text NOT NULL,
	"outcome" text
);
--> statement-breakpoint
CREATE TABLE "job_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"thread_id" text NOT NULL,
	"job_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'partial' NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"replaces_message_id" text,
	"parent_message_id" text,
	"active_child_id" text,
	"attachments" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_chat_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"thread_id" text NOT NULL,
	"job_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"model" text,
	"provider" text,
	"error_code" text,
	"error_message" text,
	"started_at" bigint NOT NULL,
	"completed_at" bigint,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"job_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	"active_root_message_id" text,
	"selected_note_ids" text DEFAULT '[]' NOT NULL,
	"selected_email_ids" text DEFAULT '[]' NOT NULL,
	"selected_document_ids" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"job_id" text NOT NULL,
	"file_name" text NOT NULL,
	"media_type" text,
	"byte_size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"job_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"source" text DEFAULT 'gradcracker' NOT NULL,
	"source_job_id" text,
	"job_url_direct" text,
	"date_posted" text,
	"title" text NOT NULL,
	"employer" text NOT NULL,
	"employer_url" text,
	"job_url" text NOT NULL,
	"application_link" text,
	"disciplines" text,
	"deadline" text,
	"salary" text,
	"location" text,
	"location_evidence" text,
	"degree_required" text,
	"starting" text,
	"job_description" text,
	"job_type" text,
	"salary_source" text,
	"salary_interval" text,
	"salary_min_amount" double precision,
	"salary_max_amount" double precision,
	"salary_currency" text,
	"is_remote" boolean,
	"job_level" text,
	"job_function" text,
	"listing_type" text,
	"emails" text,
	"company_industry" text,
	"company_logo" text,
	"company_url_direct" text,
	"company_addresses" text,
	"company_num_employees" text,
	"company_revenue" text,
	"company_description" text,
	"skills" text,
	"experience_range" text,
	"company_rating" double precision,
	"company_reviews_count" integer,
	"vacancy_count" integer,
	"work_from_home_type" text,
	"status" text DEFAULT 'discovered' NOT NULL,
	"outcome" text,
	"closed_at" bigint,
	"suitability_score" double precision,
	"suitability_reason" text,
	"job_brief" text,
	"tailored_summary" text,
	"tailored_headline" text,
	"tailored_skills" text,
	"selected_project_ids" text,
	"pdf_path" text,
	"pdf_source" text,
	"pdf_regenerating" boolean DEFAULT false NOT NULL,
	"pdf_fingerprint" text,
	"pdf_generated_at" timestamp with time zone,
	"tracer_links_enabled" boolean DEFAULT false NOT NULL,
	"sponsor_match_score" double precision,
	"sponsor_match_names" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"jobs_discovered" integer DEFAULT 0 NOT NULL,
	"jobs_processed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"config_snapshot" text,
	"requested_config" jsonb,
	"effective_config" jsonb,
	"result_summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "pipeline_search_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_application_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"account_key" text DEFAULT 'default' NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"credentials" jsonb,
	"last_connected_at" bigint,
	"last_synced_at" bigint,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_application_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"account_key" text DEFAULT 'default' NOT NULL,
	"integration_id" text,
	"sync_run_id" text,
	"external_message_id" text NOT NULL,
	"external_thread_id" text,
	"from_address" text DEFAULT '' NOT NULL,
	"from_domain" text,
	"sender_name" text,
	"subject" text DEFAULT '' NOT NULL,
	"received_at" bigint NOT NULL,
	"snippet" text DEFAULT '' NOT NULL,
	"classification_label" text,
	"classification_confidence" double precision,
	"classification_payload" jsonb,
	"relevance_llm_score" double precision,
	"relevance_decision" text DEFAULT 'needs_llm' NOT NULL,
	"match_confidence" integer,
	"message_type" text DEFAULT 'other' NOT NULL,
	"stage_event_payload" jsonb,
	"processing_status" text DEFAULT 'pending_user' NOT NULL,
	"matched_job_id" text,
	"decided_at" bigint,
	"decided_by" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_application_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"account_key" text DEFAULT 'default' NOT NULL,
	"integration_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" bigint NOT NULL,
	"completed_at" bigint,
	"messages_discovered" integer DEFAULT 0 NOT NULL,
	"messages_relevant" integer DEFAULT 0 NOT NULL,
	"messages_classified" integer DEFAULT 0 NOT NULL,
	"messages_matched" integer DEFAULT 0 NOT NULL,
	"messages_approved" integer DEFAULT 0 NOT NULL,
	"messages_denied" integer DEFAULT 0 NOT NULL,
	"messages_errored" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"application_id" text NOT NULL,
	"title" text NOT NULL,
	"group_id" text,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"metadata" jsonb,
	"outcome" text
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"application_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"due_date" bigint,
	"is_completed" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tracer_click_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"tracer_link_id" text NOT NULL,
	"clicked_at" bigint NOT NULL,
	"request_id" text,
	"is_likely_bot" boolean DEFAULT false NOT NULL,
	"device_type" text DEFAULT 'unknown' NOT NULL,
	"ua_family" text DEFAULT 'unknown' NOT NULL,
	"os_family" text DEFAULT 'unknown' NOT NULL,
	"referrer_host" text,
	"ip_hash" text,
	"unique_fingerprint_hash" text
);
--> statement-breakpoint
CREATE TABLE "tracer_links" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text,
	"token" text NOT NULL,
	"job_id" text NOT NULL,
	"source_path" text NOT NULL,
	"source_label" text NOT NULL,
	"destination_url" text NOT NULL,
	"destination_url_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracer_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_job_states" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text NOT NULL,
	"state" text DEFAULT 'ignored' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_seen_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_selected_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_default' NOT NULL,
	"user_id" text NOT NULL,
	"catalog_source_id" text,
	"label" text NOT NULL,
	"careers_url" text NOT NULL,
	"cxs_jobs_url" text,
	"source_type" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_resume_assets" ADD CONSTRAINT "design_resume_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_resume_assets" ADD CONSTRAINT "design_resume_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_resume_assets" ADD CONSTRAINT "design_resume_assets_document_id_design_resume_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."design_resume_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_resume_documents" ADD CONSTRAINT "design_resume_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_resume_documents" ADD CONSTRAINT "design_resume_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_jobs_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_messages" ADD CONSTRAINT "job_chat_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_messages" ADD CONSTRAINT "job_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_messages" ADD CONSTRAINT "job_chat_messages_thread_id_job_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."job_chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_messages" ADD CONSTRAINT "job_chat_messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_runs" ADD CONSTRAINT "job_chat_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_runs" ADD CONSTRAINT "job_chat_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_runs" ADD CONSTRAINT "job_chat_runs_thread_id_job_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."job_chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_runs" ADD CONSTRAINT "job_chat_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_threads" ADD CONSTRAINT "job_chat_threads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_threads" ADD CONSTRAINT "job_chat_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat_threads" ADD CONSTRAINT "job_chat_threads_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_search_presets" ADD CONSTRAINT "pipeline_search_presets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_integrations" ADD CONSTRAINT "post_application_integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_integrations" ADD CONSTRAINT "post_application_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_messages" ADD CONSTRAINT "post_application_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_messages" ADD CONSTRAINT "post_application_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_messages" ADD CONSTRAINT "post_application_messages_integration_id_post_application_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."post_application_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_messages" ADD CONSTRAINT "post_application_messages_sync_run_id_post_application_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."post_application_sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_messages" ADD CONSTRAINT "post_application_messages_matched_job_id_jobs_id_fk" FOREIGN KEY ("matched_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_sync_runs" ADD CONSTRAINT "post_application_sync_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_sync_runs" ADD CONSTRAINT "post_application_sync_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_application_sync_runs" ADD CONSTRAINT "post_application_sync_runs_integration_id_post_application_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."post_application_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_application_id_jobs_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_application_id_jobs_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_click_events" ADD CONSTRAINT "tracer_click_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_click_events" ADD CONSTRAINT "tracer_click_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_click_events" ADD CONSTRAINT "tracer_click_events_tracer_link_id_tracer_links_id_fk" FOREIGN KEY ("tracer_link_id") REFERENCES "public"."tracer_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_links" ADD CONSTRAINT "tracer_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_links" ADD CONSTRAINT "tracer_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracer_links" ADD CONSTRAINT "tracer_links_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_checks" ADD CONSTRAINT "watchlist_checks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_job_states" ADD CONSTRAINT "watchlist_job_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_seen_jobs" ADD CONSTRAINT "watchlist_seen_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_selected_sources" ADD CONSTRAINT "watchlist_selected_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_milestones_first_seen_at" ON "analytics_milestones" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_server_event_replays_event_name" ON "analytics_server_event_replays" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "idx_analytics_server_event_replays_occurred_at" ON "analytics_server_event_replays" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_expires_at" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_revoked_at" ON "auth_sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "idx_design_resume_assets_document_id" ON "design_resume_assets" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_job_chat_messages_thread_created" ON "job_chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_job_chat_runs_thread_status" ON "job_chat_runs" USING btree ("thread_id","status");--> statement-breakpoint
CREATE INDEX "idx_job_chat_threads_job_updated" ON "job_chat_threads" USING btree ("job_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_job_documents_job_id" ON "job_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_tenant_job_id" ON "job_documents" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_job_notes_job_updated" ON "job_notes" USING btree ("job_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_jobs_tenant_user_job_url_unique" ON "jobs" USING btree ("tenant_id",coalesce("user_id", ''),"job_url");--> statement-breakpoint
CREATE INDEX "idx_jobs_tenant_user_status" ON "jobs" USING btree ("tenant_id","user_id","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_tenant_discovered_at" ON "jobs" USING btree ("tenant_id","discovered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pipeline_search_presets_tenant_user_name_unique" ON "pipeline_search_presets" USING btree ("tenant_id","user_id","name");--> statement-breakpoint
CREATE INDEX "idx_pipeline_search_presets_tenant_user_updated" ON "pipeline_search_presets" USING btree ("tenant_id","user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_post_app_integrations_tenant_user_provider_account_unique" ON "post_application_integrations" USING btree ("tenant_id",coalesce("user_id", ''),"provider","account_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_post_app_messages_tenant_user_provider_account_external_unique" ON "post_application_messages" USING btree ("tenant_id",coalesce("user_id", ''),"provider","account_key","external_message_id");--> statement-breakpoint
CREATE INDEX "idx_post_app_messages_provider_account_processing_status" ON "post_application_messages" USING btree ("provider","account_key","processing_status");--> statement-breakpoint
CREATE INDEX "idx_post_app_sync_runs_provider_account_started_at" ON "post_application_sync_runs" USING btree ("provider","account_key","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_settings_tenant_user_key_unique" ON "settings" USING btree ("tenant_id",coalesce("user_id", ''),"key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_memberships_user_tenant" ON "tenant_memberships" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_memberships_tenant_id" ON "tenant_memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tracer_click_events_tracer_link_id" ON "tracer_click_events" USING btree ("tracer_link_id");--> statement-breakpoint
CREATE INDEX "idx_tracer_click_events_clicked_at" ON "tracer_click_events" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "idx_tracer_click_events_is_likely_bot" ON "tracer_click_events" USING btree ("is_likely_bot");--> statement-breakpoint
CREATE INDEX "idx_tracer_click_events_unique_fingerprint_hash" ON "tracer_click_events" USING btree ("unique_fingerprint_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tracer_links_tenant_user_job_source_destination_unique" ON "tracer_links" USING btree ("tenant_id",coalesce("user_id", ''),"job_id","source_path","destination_url_hash");--> statement-breakpoint
CREATE INDEX "idx_tracer_links_job_id" ON "tracer_links" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watchlist_checks_tenant_user_unique" ON "watchlist_checks" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watchlist_job_states_tenant_user_source_job_unique" ON "watchlist_job_states" USING btree ("tenant_id","user_id","source","source_job_id");--> statement-breakpoint
CREATE INDEX "idx_watchlist_job_states_tenant_user_state" ON "watchlist_job_states" USING btree ("tenant_id","user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watchlist_seen_jobs_tenant_user_source_job_unique" ON "watchlist_seen_jobs" USING btree ("tenant_id","user_id","source","source_job_id");--> statement-breakpoint
CREATE INDEX "idx_watchlist_seen_jobs_tenant_user_last_seen" ON "watchlist_seen_jobs" USING btree ("tenant_id","user_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watchlist_selected_sources_tenant_user_sort_order" ON "watchlist_selected_sources" USING btree ("tenant_id","user_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_watchlist_selected_sources_tenant_user_careers_url" ON "watchlist_selected_sources" USING btree ("tenant_id","user_id","careers_url");--> statement-breakpoint
CREATE INDEX "idx_watchlist_selected_sources_tenant_user" ON "watchlist_selected_sources" USING btree ("tenant_id","user_id");