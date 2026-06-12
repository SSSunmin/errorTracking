CREATE TYPE "public"."issue_status" AS ENUM('unresolved', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('fatal', 'error', 'warning', 'info', 'debug');--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"project_id" integer NOT NULL,
	"issue_id" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"release" text,
	"environment" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"culprit" text,
	"status" "issue_status" DEFAULT 'unresolved' NOT NULL,
	"level" "severity" DEFAULT 'error' NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"times_seen" bigint DEFAULT 1 NOT NULL,
	"user_count" integer DEFAULT 0 NOT NULL,
	"regression" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform" text DEFAULT 'javascript' NOT NULL,
	"public_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_affected" (
	"issue_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_affected_issue_id_user_id_pk" PRIMARY KEY("issue_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_affected" ADD CONSTRAINT "users_affected_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_release_name_uq" ON "artifacts" USING btree ("release_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "events_project_event_id_uq" ON "events" USING btree ("project_id","event_id");--> statement-breakpoint
CREATE INDEX "events_issue_timestamp_idx" ON "events" USING btree ("issue_id","timestamp");--> statement-breakpoint
CREATE INDEX "events_project_timestamp_idx" ON "events" USING btree ("project_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_project_fingerprint_uq" ON "issues" USING btree ("project_id","fingerprint");--> statement-breakpoint
CREATE INDEX "issues_project_last_seen_idx" ON "issues" USING btree ("project_id","last_seen");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_public_key_uq" ON "projects" USING btree ("public_key");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_project_version_uq" ON "releases" USING btree ("project_id","version");